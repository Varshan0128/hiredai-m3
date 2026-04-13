from services.resume_analysis_service import ResumeAnalysisService


PROJECT_MANAGER_RESUME = """
Career Objective
Aspiring Project Manager eager to coordinate teams, present solutions, and support delivery execution.

Education
B.E Computer Science - Nandha Engineering College - 2025

Certifications
Google Project Management Certification

Skills
Project Management, Leadership, Communication Skills, Coordination, Presentation

Projects
Built a no-code AI project prototype and coordinated the presentation for faculty review.
Led event coordination for a college symposium and handled stakeholder communication.

Extracurricular
Served as student coordinator and led cross-team event planning activities.
"""


def test_project_management_resume_prioritizes_pm_roles() -> None:
    service = ResumeAnalysisService()

    analysis = service.analyze(PROJECT_MANAGER_RESUME)

    explicit_names = [item["name"] for item in analysis["explicit_skills"]]
    inferred_names = [item["name"] for item in analysis["inferred_skills"]]
    role_titles = [item["title"] for item in analysis["recommended_roles"]]

    assert "Project Management" in explicit_names
    assert "Leadership" in explicit_names
    assert "Communication" in explicit_names
    assert "Git" not in explicit_names
    assert "SQL" not in explicit_names
    assert analysis["sections"]["objective"].lower().startswith("aspiring project manager")
    assert role_titles[0] in {"Project Coordinator", "Project Manager"}
    assert "Project Coordinator" in role_titles[:3]
    assert "Project Manager" in role_titles[:3]
    assert "Operations Analyst" in role_titles[:5]
    assert any(skill in inferred_names for skill in {"Agile", "Stakeholder Coordination", "Risk Assessment"})
    assert "@" not in analysis["sections"]["objective"]
    assert "linkedin" not in analysis["sections"]["objective"].lower()


def test_section_parser_keeps_extracurricular_out_of_projects_and_normalizes_certification() -> None:
    service = ResumeAnalysisService()

    analysis = service.analyze(PROJECT_MANAGER_RESUME)

    assert "extracurricular" in analysis["sections"]
    assert "student coordinator" in analysis["sections"]["extracurricular"].lower()
    assert "student coordinator" not in analysis["sections"]["projects"].lower()
    assert "Google Project Management Professional Certificate" in analysis["certifications"]
    assert "Certified through Google" not in analysis["certifications"]


def test_confidence_scores_and_job_explanations_are_bounded_and_grounded() -> None:
    service = ResumeAnalysisService()

    analysis = service.analyze(PROJECT_MANAGER_RESUME)

    for skill in analysis["explicit_skills"] + analysis["inferred_skills"]:
        assert 0.0 <= skill["confidence"] <= 1.0

    for role in analysis["recommended_roles"]:
        assert 0.0 <= role["score"] <= 1.0
        assert role["reason"]

    for match in analysis["similar_job_matches"]:
        assert 0.0 <= match["match_score"] <= 1.0
        for skill in match["matching_explicit_skills"]:
            assert skill in [item["name"] for item in analysis["explicit_skills"]]
        for skill in match["matching_inferred_skills"]:
            assert skill in [item["name"] for item in analysis["inferred_skills"]]
        assert "Git" not in match["reason"]
        assert "SQL" not in match["reason"]


def test_technical_skills_require_explicit_resume_evidence() -> None:
    service = ResumeAnalysisService()
    text = """
    Objective
    Seeking a project coordinator role.

    Certifications
    Google Project Management Certification

    Skills
    Communication, Leadership, Coordination
    """

    analysis = service.analyze(text)

    explicit_names = [item["name"] for item in analysis["explicit_skills"]]
    assert "Python" not in explicit_names
    assert "Git" not in explicit_names
    assert "SQL" not in explicit_names
