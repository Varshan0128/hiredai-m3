from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from db.session import Base


class ResumeProfile(Base):
    """
    Stores the latest normalized resume profile per user for this FastAPI service.

    The wider HiredAI platform already has user management elsewhere in the codebase,
    but this Python service does not currently own a `users` table. We therefore keep
    `user_id` as an indexed UUID string and enforce one latest profile per user here.

    This resume profile is intended to later feed job discovery and role matching
    modules together with psychometric outputs.
    """

    __tablename__ = "resume_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_resume_profiles_user_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    resume_file_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    inferred_roles: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    experience_level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    years_of_experience: Mapped[float | None] = mapped_column(Float, nullable=True)
    education: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    certifications: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    projects: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    languages: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    resume_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
