import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from api.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Document(Base):
    __tablename__ = "documents"

    # UUID primary key as requested
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    status = Column(String(50), default="ready", nullable=False)  # uploaded, processing, ready, failed
    page_count = Column(Integer, default=0, nullable=False)
    storage_path = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="documents")
    edit_jobs = relationship("EditJob", back_populates="document", cascade="all, delete-orphan", order_by="desc(EditJob.created_at)")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan", order_by="desc(DocumentVersion.version_number)")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "filename": self.filename,
            "status": self.status,
            "page_count": self.page_count,
            "storage_path": self.storage_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "version_count": len(self.versions) if self.versions else 0,
        }


class EditJob(Base):
    __tablename__ = "edit_jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="cascade"), nullable=False)
    prompt_text = Column(Text, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, success, failed
    error_details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="edit_jobs")

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "prompt_text": self.prompt_text,
            "status": self.status,
            "error_details": self.error_details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="cascade"), nullable=False)
    version_number = Column(Integer, default=1, nullable=False)
    storage_path = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="versions")

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "version_number": self.version_number,
            "storage_path": self.storage_path,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
