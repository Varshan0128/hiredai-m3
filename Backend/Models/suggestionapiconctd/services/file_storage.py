from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from core.settings import settings
from services.resume_parser import UnsupportedResumeFileTypeError


@dataclass
class StoredResumeFile:
    absolute_path: Path
    resume_file_url: str
    original_filename: str
    file_type: str
    size_bytes: int


class ResumeStorageError(Exception):
    pass


class ResumeStorageService:
    allowed_extensions = {".pdf", ".docx"}

    def __init__(self, upload_dir: Path | None = None, public_prefix: str | None = None) -> None:
        self.upload_dir = (upload_dir or settings.resume_upload_dir).resolve()
        self.public_prefix = (public_prefix or settings.resume_upload_prefix).rstrip("/")
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, content: bytes) -> StoredResumeFile:
        if not filename:
            raise ResumeStorageError("Resume filename is required.")
        if not content:
            raise ResumeStorageError("Uploaded resume file is empty.")
        if len(content) > settings.max_resume_file_size_bytes:
            raise ResumeStorageError(
                f"Resume file exceeds the {settings.max_resume_file_size_mb} MB upload limit."
            )

        suffix = Path(filename).suffix.lower()
        if suffix not in self.allowed_extensions:
            raise UnsupportedResumeFileTypeError("Unsupported file type. Only PDF and DOCX resumes are supported.")

        safe_name = f"{uuid4().hex}{suffix}"
        destination = self.upload_dir / safe_name
        destination.write_bytes(content)

        return StoredResumeFile(
            absolute_path=destination,
            resume_file_url=f"{self.public_prefix}/{safe_name}",
            original_filename=Path(filename).name,
            file_type=suffix.lstrip("."),
            size_bytes=len(content),
        )

    def resolve(self, resume_file_url: str) -> Path:
        if not resume_file_url:
            raise ResumeStorageError("No stored resume file reference is available.")

        file_name = Path(resume_file_url).name
        resolved = (self.upload_dir / file_name).resolve()
        if self.upload_dir not in resolved.parents and resolved != self.upload_dir / file_name:
            raise ResumeStorageError("Unsafe resume storage path detected.")
        if not resolved.exists():
            raise ResumeStorageError("Stored resume file could not be found.")
        return resolved
