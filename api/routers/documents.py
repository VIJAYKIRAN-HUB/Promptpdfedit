import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Document, DocumentVersion
from api.storage import save_upload_bytes, resolve_secure_path
from api.services.pdf_editor import get_pdf_page_count, find_text_occurrences, extract_page_text_elements
from api.services.image_converter import convert_images_to_pdf

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.post("", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a PDF document.
    Saves file to secure temporary storage, verifies PDF structure,
    records Document and initial DocumentVersion (v1) in database.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid PDF.")

    storage_path, unique_name = save_upload_bytes(content, original_filename=file.filename)

    try:
        page_count = get_pdf_page_count(storage_path)
    except Exception as e:
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise HTTPException(status_code=400, detail=f"Corrupt or unreadable PDF: {str(e)}")

    # Create Document record
    doc = Document(
        filename=file.filename,
        page_count=page_count,
        storage_path=storage_path,
        status="ready"
    )
    db.add(doc)
    db.flush()

    # Create initial DocumentVersion (v1)
    version_1 = DocumentVersion(
        document_id=doc.id,
        version_number=1,
        storage_path=storage_path
    )
    db.add(version_1)
    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "page_count": doc.page_count,
        "status": doc.status,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "active_version": 1,
        "versions": [v.to_dict() for v in doc.versions],
        "download_url": f"/api/documents/{doc.id}/file"
    }


@router.get("/{document_id}")
def get_document_metadata(
    document_id: str,
    db: Session = Depends(get_db)
):
    """Fetch metadata and version history for a document."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    versions = db.query(DocumentVersion).filter(DocumentVersion.document_id == document_id).order_by(DocumentVersion.version_number.asc()).all()

    return {
        "id": doc.id,
        "filename": doc.filename,
        "page_count": doc.page_count,
        "status": doc.status,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "versions": [v.to_dict() for v in versions],
        "active_version": versions[-1].version_number if versions else 1,
        "download_url": f"/api/documents/{doc.id}/file"
    }


@router.get("/{document_id}/file")
def download_document_file(
    document_id: str,
    version: Optional[int] = Query(None, description="Specific version number to download"),
    db: Session = Depends(get_db)
):
    """Stream PDF file contents for viewing or downloading."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    target_path = doc.storage_path
    filename = doc.filename

    if version is not None:
        ver_row = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_number == version
        ).first()
        if ver_row:
            target_path = ver_row.storage_path
            filename = f"v{version}_{doc.filename}"
        else:
            raise HTTPException(status_code=404, detail=f"Version {version} not found.")

    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="File not found on storage disk.")

    return FileResponse(
        target_path,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


@router.get("/{document_id}/search")
def search_text_in_document(
    document_id: str,
    q: str = Query(..., min_length=1, description="Search term"),
    case_sensitive: bool = Query(False),
    version: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Find exact occurrences and coordinates of a string in the PDF."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    target_path = doc.storage_path
    if version:
        ver_row = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_number == version
        ).first()
        if ver_row:
            target_path = ver_row.storage_path

    try:
        results = find_text_occurrences(target_path, search_term=q, case_sensitive=case_sensitive)
        return {
            "document_id": document_id,
            "search_term": q,
            "total_matches": len(results),
            "occurrences": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}/text-elements")
def get_document_text_elements(
    document_id: str,
    page: int = Query(1, ge=1, description="1-indexed page number"),
    version: Optional[int] = Query(None, description="Specific document version"),
    db: Session = Depends(get_db)
):
    """
    Extract flat list of TextElements (id, text, bbox, font, size, color)
    for WYSIWYG direct-click interactive canvas overlay.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    target_path = doc.storage_path
    if version:
        ver_row = db.query(DocumentVersion).filter(
            DocumentVersion.document_id == document_id,
            DocumentVersion.version_number == version
        ).first()
        if ver_row:
            target_path = ver_row.storage_path

    try:
        data = extract_page_text_elements(target_path, page_number=page)
        data["document_id"] = document_id
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text elements: {str(e)}")


@router.post("/convert-images", status_code=201)
async def convert_images(
    files: List[UploadFile] = File(...),
    fit_a4: bool = Form(True),
    margin: int = Form(40),
    db: Session = Depends(get_db)
):
    """Convert uploaded images into a clean unified A4 PDF document."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    temp_image_paths = []
    try:
        for f in files:
            content = await f.read()
            img_path, _ = save_upload_bytes(content, original_filename=f.filename)
            temp_image_paths.append(img_path)

        output_path, unique_pdf_name = save_upload_bytes(b"", original_filename="converted_images.pdf")
        
        result = convert_images_to_pdf(
            temp_image_paths,
            output_path,
            settings={"fit_a4": fit_a4, "margin": margin}
        )

        page_count = result["page_count"]
        doc = Document(
            filename="converted_images.pdf",
            page_count=page_count,
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
    finally:
        # Cleanup input image files
        for p in temp_image_paths:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass
