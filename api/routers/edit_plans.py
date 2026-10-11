import os
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Document, DocumentVersion, EditJob
from api.storage import save_upload_bytes
from api.services.llm_router import generate_edit_plan_from_prompt
from api.services.pdf_editor import find_text_occurrences, apply_text_replacement, apply_exact_replacements

router = APIRouter(prefix="/api/edit-plans", tags=["Edit Plans & Execution"])


class PlanRequest(BaseModel):
    prompt: str = Field(..., min_length=2, description="Natural language editing instruction")


class ApplyPlanRequest(BaseModel):
    operations: List[Dict[str, Any]] = Field(..., description="Approved operations list")
    prompt_text: Optional[str] = Field(default="", description="Original user prompt")


class ManualReplaceRequest(BaseModel):
    find: str = Field(..., min_length=1)
    replace_with: str = Field(default="")
    page: Optional[int] = Field(default=None)
    case_sensitive: bool = Field(default=False)


@router.post("/{document_id}")
async def create_edit_plan(
    document_id: str,
    payload: PlanRequest,
    db: Session = Depends(get_db)
):
    """
    Generate an AI Edit Plan from natural language instruction.
    Parses LLM output into discrete operations, scans PDF to confirm
    occurrences, and returns an actionable plan for user review.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Extract PDF text for context-aware plan generation
    doc_context = ""
    try:
        import fitz
        with fitz.open(doc.storage_path) as pdf_doc:
            snippets = []
            for page_idx, page in enumerate(pdf_doc):
                snippets.append(f"[Page {page_idx + 1}]\n" + page.get_text())
            doc_context = "\n".join(snippets)
    except Exception as e:
        print(f"Notice: Could not extract doc context: {e}")

    # Call LLM router with extracted document context
    plan_data = await generate_edit_plan_from_prompt(payload.prompt, document_context=doc_context)

    # Validate operations against real document content
    annotated_ops = []
    for op in plan_data.get("operations", []):
        find_text = op.get("find", "")
        occurrences = []
        if find_text:
            try:
                occurrences = find_text_occurrences(
                    doc.storage_path,
                    search_term=find_text,
                    case_sensitive=False
                )
            except Exception:
                pass

        # Filter by page if operation specifies one
        if op.get("page") is not None:
            occurrences = [occ for occ in occurrences if occ["page"] == op["page"]]

        op_copy = dict(op)
        op_copy["matches_found"] = len(occurrences)
        op_copy["occurrences"] = occurrences[:5]  # limit preview count
        op_copy["approved"] = len(occurrences) > 0  # default checked if matches exist
        annotated_ops.append(op_copy)

    return {
        "document_id": document_id,
        "prompt": payload.prompt,
        "provider": plan_data.get("provider", "rule_engine"),
        "operations": annotated_ops,
        "total_operations": len(annotated_ops),
        "note": plan_data.get("note", None)
    }


@router.post("/{document_id}/apply")
def apply_edit_plan(
    document_id: str,
    payload: ApplyPlanRequest,
    db: Session = Depends(get_db)
):
    """
    Apply confirmed edit plan operations to create a new DocumentVersion.
    Records EditJob history and updates active document storage path.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not payload.operations:
        raise HTTPException(status_code=400, detail="No operations provided to apply.")

    # Record EditJob
    edit_job = EditJob(
        document_id=doc.id,
        prompt_text=payload.prompt_text or "Batch Edit Plan",
        status="pending"
    )
    db.add(edit_job)
    db.flush()

    # Determine next version number
    latest_version = db.query(DocumentVersion).filter(
        DocumentVersion.document_id == document_id
    ).order_by(DocumentVersion.version_number.desc()).first()

    next_version_num = (latest_version.version_number + 1) if latest_version else 2

    # Prepare output path for new version
    version_filename = f"v{next_version_num}_{doc.filename}"
    new_storage_path, _ = save_upload_bytes(b"", original_filename=version_filename)

    try:
        result = apply_exact_replacements(
            filepath=doc.storage_path,
            operations=payload.operations,
            output_path=new_storage_path
        )

        # Create new version record
        new_version = DocumentVersion(
            document_id=doc.id,
            version_number=next_version_num,
            storage_path=new_storage_path
        )
        db.add(new_version)

        # Update doc storage path to latest
        doc.storage_path = new_storage_path
        edit_job.status = "success"
        db.commit()

        return {
            "success": True,
            "document_id": doc.id,
            "new_version": next_version_num,
            "total_replaced": result.get("total_replaced", 0),
            "warnings": result.get("warnings", []),
            "download_url": f"/api/documents/{doc.id}/file?version={next_version_num}",
            "previous_version_url": f"/api/documents/{doc.id}/file?version={next_version_num - 1}"
        }

    except Exception as e:
        edit_job.status = "failed"
        edit_job.error_details = str(e)
        db.commit()
        if os.path.exists(new_storage_path):
            try:
                os.remove(new_storage_path)
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=f"Failed to apply edit plan: {str(e)}")
