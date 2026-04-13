from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from models.resume_profile import ResumeProfile
from services.file_storage import StoredResumeFile


class ResumeProfileNotFoundError(Exception):
    pass


class ResumeProfileService:
    """
    Persists the latest normalized resume profile per user.

    We intentionally keep one current profile row per user in this service so later
    job discovery and role matching can consume a stable profile snapshot.
    """

    def create_or_update_profile(
        self,
        *,
        db: Session,
        user_id: UUID | str,
        analysis: dict,
        stored_file: StoredResumeFile | None = None,
    ) -> ResumeProfile:
        user_id_str = str(user_id)
        profile = db.query(ResumeProfile).filter(ResumeProfile.user_id == user_id_str).one_or_none()

        if profile is None:
            profile = ResumeProfile(user_id=user_id_str, raw_text=analysis["raw_text"])
            db.add(profile)

        profile.raw_text = analysis["raw_text"]
        profile.skills = [item["name"] for item in analysis.get("explicit_skills", [])]
        profile.inferred_roles = [item["title"] for item in analysis.get("recommended_roles", [])]
        profile.experience_level = analysis["experience_level"]
        profile.years_of_experience = analysis["years_of_experience"]
        profile.education = analysis["education"]
        profile.certifications = analysis["certifications"]
        profile.projects = analysis["projects"]
        profile.languages = analysis["languages"]
        profile.resume_score = analysis["resume_score"]

        if stored_file is not None:
            profile.resume_file_url = stored_file.resume_file_url
            profile.original_filename = stored_file.original_filename
            profile.file_type = stored_file.file_type

        db.commit()
        db.refresh(profile)
        return profile

    def get_latest_profile(self, db: Session, user_id: UUID | str) -> ResumeProfile:
        profile = db.query(ResumeProfile).filter(ResumeProfile.user_id == str(user_id)).one_or_none()
        if profile is None:
            raise ResumeProfileNotFoundError("Resume profile not found for the requested user.")
        return profile
