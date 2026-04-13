from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SkillEvidence(BaseModel):
    name: str
    confidence: float
    source: str | None = None
    section: str | None = None


class EducationItem(BaseModel):
    degree: str | None = None
    institution: str | None = None
    field_of_study: str | None = None
    graduation_year: str | None = None


class ProjectItem(BaseModel):
    name: str
    tech_stack: list[str] = Field(default_factory=list)
    summary: str | None = None


class RoleRecommendation(BaseModel):
    title: str
    score: float
    reason: str


class JobMatch(BaseModel):
    role: str
    company: str
    match_score: float
    matching_explicit_skills: list[str] = Field(default_factory=list)
    matching_inferred_skills: list[str] = Field(default_factory=list)
    reason: str


class ResumeAnalyzeRequest(BaseModel):
    user_id: UUID
    raw_text: str | None = None
    use_latest_uploaded_file: bool = False


class ResumeProfileUpdate(BaseModel):
    raw_text: str | None = None


class ResumeProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    resume_file_url: str | None = None
    original_filename: str | None = None
    file_type: str | None = None
    raw_text: str
    explicit_skills: list[SkillEvidence] = Field(default_factory=list)
    inferred_skills: list[SkillEvidence] = Field(default_factory=list)
    recommended_roles: list[RoleRecommendation] = Field(default_factory=list)
    similar_job_matches: list[JobMatch] = Field(default_factory=list)
    experience_level: str | None = None
    years_of_experience: float | None = None
    education: list[EducationItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    resume_score: float | None = None
    career_score: int | None = None
    ai_risk: int | None = None
    market_demand: int | None = None
    time_to_hire_weeks: list[int] = Field(default_factory=list)
    sections: dict[str, str] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ResumeUploadResponse(BaseModel):
    message: str
    profile: ResumeProfileResponse


class ResumeAnalysisPayload(BaseModel):
    explicit_skills: list[SkillEvidence] = Field(default_factory=list)
    inferred_skills: list[SkillEvidence] = Field(default_factory=list)
    recommended_roles: list[RoleRecommendation] = Field(default_factory=list)
    similar_job_matches: list[JobMatch] = Field(default_factory=list)
    experience_level: str | None = None
    years_of_experience: float | None = None
    education: list[EducationItem] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    resume_score: float = 0.0
    career_score: int = 0
    ai_risk: int = 0
    market_demand: int = 0
    time_to_hire_weeks: list[int] = Field(default_factory=list)


class ResumeAnalysisResult(BaseModel):
    user_id: UUID
    raw_text: str
    analysis: ResumeAnalysisPayload
    metadata: dict[str, Any] = Field(default_factory=dict)
