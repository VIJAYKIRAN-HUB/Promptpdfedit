import os
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Document, DocumentVersion
from api.storage import save_upload_bytes
from api.services.image_converter import (
    convert_images_to_pdf_with_reportlab,
    convert_freeform_pages_to_pdf_with_reportlab
)

router = APIRouter(prefix="/api/conversions", tags=["Conversions"])


@router.post("/images-to-pdf", status_code=201)
async def convert_images_to_pdf_endpoint(
    files: List[UploadFile] = File(...),
    pages_json: Optional[str] = Form(None),      # Freeform canvas payload: [{"page_num": 1, "images": [{"file_id": "...", "x": 10, "y": 10, "width": 200, "height": 150}]}]
    sheet_settings: Optional[str] = Form(None),  # Legacy sheet settings: [{"filename": "...", "fit_mode": "fit"}]
    margin: int = Form(20),
    db: Session = Depends(get_db)
):
    """
    Generate PDF from images using ReportLab canvas.
    Supports Word-style freeform multi-page layout with (x, y, width, height) coordinates,
    as well as standard multi-sheet grids.
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one image file is required.")

    saved_files = {}
    temp_paths_to_clean = []

    try:
        # Save uploaded image bytes to storage
        for f in files:
            content = await f.read()
            temp_path, _ = save_upload_bytes(content, original_filename=f.filename)
            saved_files[f.filename] = temp_path
            # Also store with simple index identifiers for frontend convenience
            temp_paths_to_clean.append(temp_path)

        output_path, unique_pdf_name = save_upload_bytes(b"", original_filename="PromptPDFEdit_Document.pdf")

        # MODE 1: Freeform Multi-Page Canvas with exact coordinates
        if pages_json:
            try:
                pages_data = json.loads(pages_json)
                if not isinstance(pages_data, list) and isinstance(pages_data, dict):
                    pages_data = pages_data.get("pages", [pages_data])
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid pages_json format: {str(e)}")

            result = convert_freeform_pages_to_pdf_with_reportlab(
                pages_payload=pages_data,
                file_map=saved_files,
                output_path=output_path
            )

        # MODE 2: Multi-Sheet Grid layout (legacy / fallback)
        else:
            settings_map = {}
            ordered_filenames = []
            if sheet_settings:
                try:
                    parsed = json.loads(sheet_settings)
                    if isinstance(parsed, list):
                        for item in parsed:
                            fname = item.get("filename")
                            if fname:
                                settings_map[fname] = item
                                ordered_filenames.append(fname)
                except Exception:
                    pass

            sheet_items = []
            if ordered_filenames:
                for fname in ordered_filenames:
                    if fname in saved_files:
                        item_conf = settings_map.get(fname, {})
                        sheet_items.append({
                            "filepath": saved_files[fname],
                            "fit_mode": item_conf.get("fit_mode", "fit"),
                            "margin": item_conf.get("margin", margin)
                        })
            else:
                for fname, path in saved_files.items():
                    sheet_items.append({
                        "filepath": path,
                        "fit_mode": "fit",
                        "margin": margin
                    })

            result = convert_images_to_pdf_with_reportlab(
                sheet_items=sheet_items,
                output_path=output_path,
                global_settings={"margin": margin}
            )

        # Record in database
        doc = Document(
            filename="PromptPDFEdit_Document.pdf",
            page_count=result["page_count"],
            storage_path=output_path,
            status="ready"
        )
        db.add(doc)
        db.flush()

        v1 = DocumentVersion(
            document_id=doc.id,
            version_number=1,
            storage_path=output_path
        )
        db.add(v1)
        db.commit()
        db.refresh(doc)

        return {
            "id": doc.id,
            "filename": doc.filename,
            "page_count": doc.page_count,
            "status": doc.status,
            "download_url": f"/api/documents/{doc.id}/file"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    finally:
        for p in temp_paths_to_clean:
            try:
                if os.path.exists(p):
                    os.remove(p)
            except Exception:
                pass
