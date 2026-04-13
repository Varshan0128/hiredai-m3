from __future__ import annotations

import re
from pathlib import Path

import PyPDF2
from docx import Document


SUPPORTED_RESUME_TYPES = {".pdf", ".docx"}


class ResumeParserError(Exception):
    pass


class UnsupportedResumeFileTypeError(ResumeParserError):
    pass


class CorruptedResumeFileError(ResumeParserError):
    pass


class EmptyResumeError(ResumeParserError):
    pass


class ResumeParserService:
    def detect_file_type(self, filename: str) -> str:
        suffix = Path(filename or "").suffix.lower()
        if suffix not in SUPPORTED_RESUME_TYPES:
            raise UnsupportedResumeFileTypeError("Unsupported file type. Only PDF and DOCX resumes are supported.")
        return suffix.lstrip(".")

    def extract_text(self, file_path: str | Path, file_type: str | None = None) -> str:
        path = Path(file_path)
        effective_type = file_type or self.detect_file_type(path.name)

        if effective_type == "pdf":
            text = self._extract_pdf_text(path)
        elif effective_type == "docx":
            text = self._extract_docx_text(path)
        else:
            raise UnsupportedResumeFileTypeError("Unsupported file type. Only PDF and DOCX resumes are supported.")

        cleaned = self._normalize_text(text)
        if not cleaned:
            raise EmptyResumeError("Resume file contains no readable text.")
        return cleaned

    def _extract_pdf_text(self, file_path: Path) -> str:
        try:
            with file_path.open("rb") as handle:
                reader = PyPDF2.PdfReader(handle)
                chunks = [page.extract_text() or "" for page in reader.pages]
        except Exception as exc:
            raise CorruptedResumeFileError("Failed to parse PDF resume.") from exc
        return "\n".join(chunks)

    def _extract_docx_text(self, file_path: Path) -> str:
        try:
            document = Document(str(file_path))
        except Exception as exc:
            raise CorruptedResumeFileError("Failed to parse DOCX resume.") from exc

        paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        return "\n".join(paragraphs)

    @staticmethod
    def _normalize_text(value: str) -> str:
        value = value.replace("\x00", " ")
        value = re.sub(r"\r\n?", "\n", value)
        value = re.sub(r"[ \t]+", " ", value)
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value.strip()
