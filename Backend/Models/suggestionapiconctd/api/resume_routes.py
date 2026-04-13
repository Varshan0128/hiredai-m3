from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.resume import ResumeAnalyzeRequest, ResumeProfileResponse, ResumeUploadResponse
from services.file_storage import ResumeStorageError, ResumeStorageService
from services.resume_analysis_service import ResumeAnalysisService
from services.resume_parser import (
    CorruptedResumeFileError,
    EmptyResumeError,
    ResumeParserService,
    UnsupportedResumeFileTypeError,
)
from services.resume_profile_service import ResumeProfileNotFoundError, ResumeProfileService


router = APIRouter(prefix="/api/v1/resume", tags=["resume"])

parser_service = ResumeParserService()
analysis_service = ResumeAnalysisService()
profile_service = ResumeProfileService()
storage_service = ResumeStorageService()


def _build_profile_response(profile, analysis: dict | None = None) -> ResumeProfileResponse:
    analysis = analysis or analysis_service.analyze(profile.raw_text)
    return ResumeProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        resume_file_url=profile.resume_file_url,
        original_filename=profile.original_filename,
        file_type=profile.file_type,
        raw_text=profile.raw_text,
        explicit_skills=analysis.get("explicit_skills", []),
        inferred_skills=analysis.get("inferred_skills", []),
        recommended_roles=analysis.get("recommended_roles", []),
        similar_job_matches=analysis.get("similar_job_matches", []),
        experience_level=analysis.get("experience_level"),
        years_of_experience=analysis.get("years_of_experience"),
        education=analysis.get("education", []),
        certifications=analysis.get("certifications", []),
        projects=analysis.get("projects", []),
        languages=analysis.get("languages", []),
        resume_score=analysis.get("resume_score"),
        career_score=analysis.get("career_score"),
        ai_risk=analysis.get("ai_risk"),
        market_demand=analysis.get("market_demand"),
        time_to_hire_weeks=analysis.get("time_to_hire_weeks", []),
        sections=analysis.get("sections", {}),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    user_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ResumeUploadResponse:
    try:
        content = await file.read()
        stored_file = storage_service.save(file.filename or "", content)
        raw_text = parser_service.extract_text(stored_file.absolute_path, stored_file.file_type)
        analysis = analysis_service.analyze(raw_text)
        profile = profile_service.create_or_update_profile(
            db=db,
            user_id=user_id,
            analysis=analysis,
            stored_file=stored_file,
        )
        return ResumeUploadResponse(
            message="Resume uploaded, analyzed, and saved successfully.",
            profile=_build_profile_response(profile, analysis),
        )
    except UnsupportedResumeFileTypeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except (ResumeStorageError, EmptyResumeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CorruptedResumeFileError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post("/analyze", response_model=ResumeUploadResponse)
async def analyze_resume(
    request: ResumeAnalyzeRequest,
    db: Session = Depends(get_db),
) -> ResumeUploadResponse:
    try:
        if request.raw_text and request.raw_text.strip():
            analysis = analysis_service.analyze(request.raw_text)
        elif request.use_latest_uploaded_file:
            profile = profile_service.get_latest_profile(db, request.user_id)
            if not profile.resume_file_url:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No uploaded resume file is available to re-analyze.")
            stored_path = storage_service.resolve(profile.resume_file_url)
            analysis = analysis_service.analyze(parser_service.extract_text(stored_path, profile.file_type))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide `raw_text` or set `use_latest_uploaded_file=true`.",
            )

        profile = profile_service.create_or_update_profile(
            db=db,
            user_id=request.user_id,
            analysis=analysis,
            stored_file=None,
        )
        return ResumeUploadResponse(
            message="Resume analyzed and profile updated successfully.",
            profile=_build_profile_response(profile, analysis),
        )
    except ResumeProfileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except UnsupportedResumeFileTypeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except (ResumeStorageError, EmptyResumeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except CorruptedResumeFileError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get("/profile/{user_id}", response_model=ResumeProfileResponse)
async def get_resume_profile(
    user_id: UUID,
    db: Session = Depends(get_db),
) -> ResumeProfileResponse:
    try:
        profile = profile_service.get_latest_profile(db, user_id)
        return _build_profile_response(profile)
    except ResumeProfileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/profile/{user_id}", response_model=ResumeUploadResponse)
async def replace_resume_profile(
    user_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ResumeUploadResponse:
    return await upload_resume(user_id=user_id, file=file, db=db)
