import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Document, DocumentVersion
from api.storage import delete_file_if_exists, purge_expired_storage_files

router = APIRouter(prefix="/api/cron", tags=["Maintenance & Cron"])


def verify_cron_auth(
    authorization: Optional[str] = Header(None),
    secret: Optional[str] = Query(None)
):
    """
    Verify Vercel Cron authorization header or secret query parameter.
    If CRON_SECRET is configured in environment, unauthenticated calls are blocked.
    """
    expected = os.getenv("CRON_SECRET", "").strip()
    if not expected:
        return True  # If no secret configured in dev mode, allow execution

    # Vercel sends `Authorization: Bearer <CRON_SECRET>`
    bearer_token = ""
    if authorization and authorization.startswith("Bearer "):
        bearer_token = authorization.split("Bearer ")[1].strip()

    if bearer_token == expected or secret == expected:
        return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized cron trigger: Invalid or missing CRON_SECRET token."
    )


@router.api_route("/cleanup", methods=["GET", "DELETE"])
def run_storage_and_db_cleanup(
    authorized: bool = Depends(verify_cron_auth),
    max_age_hours: int = Query(1, description="File age threshold in hours"),
    db: Session = Depends(get_db)
):
    """
    Sweeps the /tmp storage directory and database records:
    Deletes any documents and physical PDF files older than 1 hour (or custom threshold).
    Ensures zero persistent retention and strict auto-destruct compliance.
    """
    threshold_time = datetime.utcnow() - timedelta(hours=max_age_hours)
    expired_docs = db.query(Document).filter(Document.created_at < threshold_time).all()

    documents_deleted = 0
    files_deleted = 0

    for doc in expired_docs:
        # Delete root document file
        if doc.storage_path and delete_file_if_exists(doc.storage_path):
            files_deleted += 1

        # Delete all versioned physical files
        for v in doc.versions:
            if v.storage_path and delete_file_if_exists(v.storage_path):
                files_deleted += 1

        db.delete(doc)
        documents_deleted += 1

    db.commit()

    # Also sweep disk for any orphaned files in storage directory
    orphaned_disk_purged = purge_expired_storage_files(max_age_seconds=max_age_hours * 3600)
    total_files_purged = files_deleted + orphaned_disk_purged

    return {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat(),
        "retention_threshold_hours": max_age_hours,
        "documents_deleted": documents_deleted,
        "total_files_purged": total_files_purged,
        "message": f"Purged {documents_deleted} expired documents and {total_files_purged} temporary files."
    }
