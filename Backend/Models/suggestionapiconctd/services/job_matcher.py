from __future__ import annotations

from typing import Any


JOB_LIBRARY: list[dict[str, Any]] = [
    {
        "role": "Project Coordinator Intern",
        "company": "Example Co",
        "role_family": "project",
        "required_explicit_skills": {"Project Management", "Communication", "Leadership"},
        "preferred_inferred_skills": {"Agile", "Stakeholder Coordination"},
        "certification_keywords": {"google project management certification", "project management"},
        "project_keywords": {"coordination", "event", "timeline", "planning"},
        "experience_target": "fresher",
        "location": "India",
        "work_mode": "Hybrid",
    },
    {
        "role": "Project Manager Trainee",
        "company": "Launchpad Labs",
        "role_family": "project",
        "required_explicit_skills": {"Project Management", "Leadership", "Communication"},
        "preferred_inferred_skills": {"Agile", "Risk Assessment", "Stakeholder Coordination"},
        "certification_keywords": {"google project management certification", "project management"},
        "project_keywords": {"planning", "coordination", "execution", "presentation"},
        "experience_target": "fresher",
        "location": "India",
        "work_mode": "On-site",
    },
    {
        "role": "Program Coordinator",
        "company": "CivicSphere",
        "role_family": "project",
        "required_explicit_skills": {"Communication", "Leadership", "Presentation"},
        "preferred_inferred_skills": {"Stakeholder Coordination", "Documentation", "Agile"},
        "certification_keywords": {"google project management certification"},
        "project_keywords": {"event", "coordination", "team", "planning"},
        "experience_target": "fresher",
        "location": "India",
        "work_mode": "Hybrid",
    },
    {
        "role": "Operations Coordinator",
        "company": "Coordina Works",
        "role_family": "project",
        "required_explicit_skills": {"Coordination", "Communication", "Leadership"},
        "preferred_inferred_skills": {"Documentation", "Stakeholder Coordination", "Process Improvement"},
        "certification_keywords": {"google project management certification", "project management"},
        "project_keywords": {"coordination", "tracking", "timeline", "operations"},
        "experience_target": "fresher",
        "location": "India",
        "work_mode": "Hybrid",
    },
    {
        "role": "Operations Analyst",
        "company": "OpsBridge",
        "role_family": "operations",
        "required_explicit_skills": {"Communication", "Leadership", "Problem Solving"},
        "preferred_inferred_skills": {"Process Improvement", "Stakeholder Coordination", "Documentation"},
        "certification_keywords": {"project management"},
        "project_keywords": {"operations", "process", "coordination", "analysis"},
        "experience_target": "fresher",
        "location": "India",
        "work_mode": "Hybrid",
    },
    {
        "role": "Business Operations Associate",
        "company": "ScaleFlow",
        "role_family": "project",
        "required_explicit_skills": {"Communication", "Leadership", "Coordination"},
        "preferred_inferred_skills": {"Documentation", "Stakeholder Coordination", "Process Improvement"},
        "certification_keywords": {"project management"},
        "project_keywords": {"planning", "operations", "coordination"},
        "experience_target": "fresher",
        "location": "India",
        "work_mode": "Hybrid",
    },
]


class JobMatcher:
    def match_jobs(
        self,
        *,
        recommended_roles: list[dict[str, Any]],
        explicit_skills: list[dict[str, Any]],
        inferred_skills: list[dict[str, Any]],
        certifications: list[str],
        projects: list[dict[str, Any]],
        experience_level: str,
        location: str = "India",
    ) -> list[dict[str, Any]]:
        explicit_names = {item["name"] for item in explicit_skills}
        inferred_names = {item["name"] for item in inferred_skills}
        explicit_skill_confidence = {item["name"]: float(item.get("confidence", 0.0)) for item in explicit_skills}
        inferred_skill_confidence = {item["name"]: float(item.get("confidence", 0.0)) for item in inferred_skills}
        certification_text = " ".join(certifications).lower()
        project_text = " ".join(project.get("summary", "") for project in projects).lower()
        role_scores = {item["title"]: item["score"] for item in recommended_roles}
        top_role = recommended_roles[0]["title"] if recommended_roles else ""
        top_role_lower = top_role.lower()

        matches: list[dict[str, Any]] = []
        for job in JOB_LIBRARY:
            role_alignment = self._score_role_alignment(job["role"], role_scores)
            explicit_overlap = self._score_weighted_overlap(explicit_skill_confidence, job["required_explicit_skills"])
            inferred_overlap = self._score_weighted_overlap(inferred_skill_confidence, job["preferred_inferred_skills"])
            certification_relevance = self._score_keyword_presence(certification_text, job["certification_keywords"])
            project_relevance = self._score_keyword_presence(project_text, job["project_keywords"])
            fresher_fit = 1.0 if experience_level == job["experience_target"] else 0.55
            keyword_similarity = self._score_keyword_presence(project_text, {value.lower() for value in job["project_keywords"]})

            location_fit = 1.0 if not location or location.lower() in {"india", job["location"].lower()} else 0.8
            family_bias = self._score_family_bias(job["role_family"], top_role_lower)
            role_alignment = min(1.0, role_alignment + family_bias)

            score = (
                0.38 * role_alignment +
                0.25 * explicit_overlap +
                0.07 * inferred_overlap +
                0.12 * certification_relevance +
                0.10 * project_relevance +
                0.06 * fresher_fit +
                0.02 * keyword_similarity
            ) * location_fit

            if "project" in top_role_lower and job["role_family"] == "operations" and role_alignment < 0.78:
                score -= 0.08
            if score < 0.45:
                continue

            matching_explicit = sorted(
                skill for skill in (explicit_names & job["required_explicit_skills"])
                if explicit_skill_confidence.get(skill, 0.0) >= 0.6
            )
            matching_inferred = sorted(
                skill for skill in (inferred_names & job["preferred_inferred_skills"])
                if inferred_skill_confidence.get(skill, 0.0) >= 0.55
            )
            reason_parts = []
            if role_alignment >= 0.7:
                reason_parts.append(f"role alignment is strong with {top_role or job['role']}")
            if matching_explicit:
                reason_parts.append(f"explicit evidence includes {', '.join(matching_explicit[:3])}")
            if certification_relevance >= 0.7:
                reason_parts.append("project-management certification support is present")
            if project_relevance >= 0.6:
                reason_parts.append("project and coordination evidence matches the role expectations")
            if fresher_fit >= 1.0:
                reason_parts.append("the role fits a fresher profile")
            if matching_inferred:
                reason_parts.append(f"lower-confidence adjacent signals include {', '.join(matching_inferred[:2])}")

            matches.append(
                {
                    "role": job["role"],
                    "company": job["company"],
                    "match_score": round(min(score, 0.99), 2),
                    "matching_explicit_skills": matching_explicit,
                    "matching_inferred_skills": matching_inferred,
                    "reason": "; ".join(reason_parts) or "moderate alignment from role, certification, and project signals.",
                }
            )

        matches.sort(key=lambda item: item["match_score"], reverse=True)
        return matches[:5]

    @staticmethod
    def _score_role_alignment(job_role: str, role_scores: dict[str, float]) -> float:
        lowered_job_role = job_role.lower()
        best = 0.0
        for title, score in role_scores.items():
            if title.lower() in lowered_job_role or lowered_job_role in title.lower():
                best = max(best, score)
        return best or max(role_scores.values(), default=0.0) * 0.65

    @staticmethod
    def _score_overlap(actual: set[str], required: set[str]) -> float:
        if not required:
            return 0.0
        return min(len(actual & required) / len(required), 1.0)

    @staticmethod
    def _score_weighted_overlap(actual: dict[str, float], required: set[str]) -> float:
        if not required:
            return 0.0
        total = sum(actual.get(skill, 0.0) for skill in required)
        return min(total / len(required), 1.0)

    @staticmethod
    def _score_keyword_presence(text: str, keywords: set[str]) -> float:
        if not keywords:
            return 0.0
        hits = sum(1 for keyword in keywords if keyword.lower() in text)
        return min(hits / len(keywords), 1.0)

    @staticmethod
    def _score_family_bias(role_family: str, top_role: str) -> float:
        if not top_role:
            return 0.0
        if "project" in top_role or "program" in top_role or "coordinator" in top_role:
            return 0.15 if role_family == "project" else -0.04
        if "operations" in top_role or "business operations" in top_role:
            return 0.1 if role_family == "operations" else 0.0
        return 0.0
