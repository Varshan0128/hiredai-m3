from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


for _parent in Path(__file__).resolve().parents:
    _env_file = _parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file, override=False)
        break


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_UPLOAD_DIR = BASE_DIR / "uploads" / "resumes"


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(BASE_DIR / 'resume_profiles.db').as_posix()}",
    )
    resume_upload_dir: Path = Path(
        os.getenv("RESUME_UPLOAD_DIR", str(DEFAULT_UPLOAD_DIR))
    ).resolve()
    resume_upload_prefix: str = os.getenv("RESUME_UPLOAD_PREFIX", "/uploads/resumes")
    max_resume_file_size_mb: int = int(os.getenv("MAX_RESUME_FILE_SIZE_MB", "5"))

    @property
    def max_resume_file_size_bytes(self) -> int:
        return self.max_resume_file_size_mb * 1024 * 1024


settings = Settings()
