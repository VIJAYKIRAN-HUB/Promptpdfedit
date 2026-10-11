import os
import re
import time
import uuid
import tempfile
from pathlib import Path
from typing import Tuple, Optional


def get_storage_dir() -> Path:
    """
    Get the configured storage directory.
    Defaults to /tmp (required for Vercel Serverless environment),
    or falls back to local tempfile/tmp for cross-platform local development.
    """
    custom_dir = os.getenv("STORAGE_DIR", "").strip()
    if custom_dir:
        target = Path(custom_dir)
    elif os.name != "nt" and os.path.exists("/tmp"):
        target = Path("/tmp/promptpdf")
    else:
        target = Path(tempfile.gettempdir()) / "promptpdf"

    target.mkdir(parents=True, exist_ok=True)
    return target


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal or invalid characters."""
    clean = os.path.basename(filename)
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', clean)
    return clean or f"file_{uuid.uuid4().hex[:8]}.pdf"


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique UUID-prefixed filename to prevent overwrites."""
    sanitized = sanitize_filename(original_filename)
    unique_id = uuid.uuid4().hex
    return f"{unique_id}_{sanitized}"


def save_upload_bytes(data: bytes, original_filename: str = "document.pdf") -> Tuple[str, str]:
    """
    Save raw bytes to secure storage.
    Returns: (absolute_file_path, unique_filename)
    """
    storage_dir = get_storage_dir()
    unique_name = generate_unique_filename(original_filename)
    target_path = storage_dir / unique_name

    with open(target_path, "wb") as f:
        f.write(data)

    return str(target_path.resolve()), unique_name


def resolve_secure_path(filepath: str) -> Optional[Path]:
    """
    Validate that the requested filepath is inside the authorized storage dir,
    preventing path traversal vulnerabilities.
    """
    storage_dir = get_storage_dir().resolve()
    candidate = Path(filepath).resolve()
    try:
        candidate.relative_to(storage_dir)
        if candidate.exists() and candidate.is_file():
            return candidate
    except ValueError:
        pass
    return None


def delete_file_if_exists(filepath: str) -> bool:
    """Safely delete a file if it exists."""
    try:
        path = Path(filepath)
        if path.exists():
            path.unlink()
            return True
    except Exception:
        pass
    return False


def purge_expired_storage_files(max_age_seconds: int = 3600) -> int:
    """
    Remove all files in storage directory older than max_age_seconds.
    Used for 1-hour auto-destruct privacy compliance.
    Returns number of purged files.
    """
    storage_dir = get_storage_dir()
    now = time.time()
    purged_count = 0

    if not storage_dir.exists():
        return 0

    for item in storage_dir.iterdir():
        if item.is_file():
            try:
                file_age = now - item.stat().st_mtime
                if file_age > max_age_seconds:
                    item.unlink()
                    purged_count += 1
            except Exception:
                continue

    return purged_count
