from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

from services.job_matcher import JobMatcher
from services.resume_section_parser import ResumeSectionParser


logger = logging.getLogger(__name__)


SECTION_WEIGHTS: dict[str, float] = {
    "objective": 1.0,
    "certifications": 0.9,
    "skills": 0.88,
    "strengths": 0.82,
    "projects": 0.72,
    "experience": 0.75,
    "extracurricular": 0.58,
    "coursework": 0.42,
    "education": 0.32,
    "other": 0.2,
}

ROLE_COMPONENT_WEIGHTS: dict[str, float] = {
    "objective": 0.30,
    "certifications": 0.25,
    "explicit_skills": 0.20,
    "projects": 0.15,
    "extracurricular": 0.07,
    "coursework": 0.03,
}

PM_FAMILY_ROLES = {
    "Project Coordinator",
    "Project Manager",
    "Program Coordinator",
    "Operations Coordinator",
    "Business Operations Associate",
    "Operations Analyst",
    "PMO Analyst",
}

LANGUAGE_CANDIDATES = (
    "English", "Tamil", "Hindi", "French", "German", "Spanish", "Telugu",
    "Kannada", "Malayalam", "Arabic", "Japanese", "Mandarin",
)

DEGREE_KEYWORDS = ("b.tech", "b.e", "bachelor", "master", "m.tech", "m.e", "mba", "b.sc", "m.sc", "phd")


@dataclass(frozen=True)
class SkillRule:
    name: str
    patterns: tuple[str, ...]
    explicit_sections: tuple[str, ...]
    explicit_confidence: float
    inferred_patterns: tuple[str, ...] = ()
    inferred_sections: tuple[str, ...] = ()
    inferred_confidence: float = 0.0


@dataclass(frozen=True)
class RoleRule:
    title: str
    objective_patterns: tuple[str, ...]
    certification_patterns: tuple[str, ...]
    explicit_skills: tuple[str, ...]
    project_patterns: tuple[str, ...]
    extracurricular_patterns: tuple[str, ...]
    coursework_patterns: tuple[str, ...]


SKILL_RULES: tuple[SkillRule, ...] = (
    SkillRule("Project Management", (r"\bproject management\b", r"\bproject manager\b"), ("objective", "skills", "certifications", "projects", "strengths"), 0.98),
    SkillRule("Project Coordination", (r"\bproject coordination\b", r"\bproject coordinator\b"), ("objective", "skills", "projects", "experience"), 0.96, (r"\bcoordinate(?:d|s|ing)? projects?\b",), ("projects", "experience", "extracurricular"), 0.72),
    SkillRule("Program Coordination", (r"\bprogram coordination\b", r"\bprogram coordinator\b"), ("objective", "skills", "experience"), 0.95, (r"\bprogram planning\b",), ("projects", "extracurricular"), 0.68),
    SkillRule("Leadership", (r"\bleadership\b", r"\bled\b", r"\bleading\b"), ("objective", "skills", "strengths", "extracurricular"), 0.96),
    SkillRule("Communication", (r"\bcommunication skills?\b", r"\bstrong communication\b"), ("objective", "skills", "strengths"), 0.95),
    SkillRule("Presentation", (r"\bpresentation(?:s)?\b", r"\bpresented\b", r"\bpresentation leadership\b"), ("skills", "projects", "extracurricular", "strengths"), 0.86),
    SkillRule("Stakeholder Handling", (r"\bstakeholder handling\b", r"\bstakeholder management\b"), ("skills", "projects", "experience"), 0.88, (r"\bstakeholder\b",), ("objective", "projects", "experience", "certifications"), 0.78),
    SkillRule("Coordination", (r"\bcoordination\b", r"\bcoordinated\b"), ("skills", "projects", "experience", "extracurricular"), 0.9),
    SkillRule("Documentation", (r"\bdocumentation\b", r"\breporting\b"), ("skills", "projects", "experience"), 0.82),
    SkillRule("Problem Solving", (r"\bproblem solving\b",), ("skills", "strengths"), 0.9),
    SkillRule("Time Management", (r"\btime management\b",), ("skills", "strengths"), 0.88),
    SkillRule("Operations", (r"\boperations\b", r"\bbusiness operations\b"), ("objective", "skills", "experience"), 0.9),
    SkillRule("Event Coordination", (r"\bevent coordination\b", r"\bevent management\b"), ("projects", "extracurricular", "experience"), 0.92),
    SkillRule("Process Improvement", (r"\bprocess improvement\b",), ("skills", "experience"), 0.84, (r"\bprocess\b",), ("projects", "experience"), 0.63),
    SkillRule("No-Code Prototyping", (r"\bno[- ]code\b", r"\bprototype(?:d|s|ing)?\b"), ("projects", "experience"), 0.86),
    SkillRule("AI Prototyping", (r"\bai project\b", r"\bai prototyp(?:e|ing)\b", r"\bartificial intelligence\b"), ("projects", "objective", "experience"), 0.82),
    SkillRule("Agile", (), (), 0.0, (r"\bagile\b", r"\bscrum\b"), ("certifications", "projects"), 0.7),
    SkillRule("Scrum", (), (), 0.0, (r"\bscrum\b",), ("certifications", "projects"), 0.68),
    SkillRule("Risk Assessment", (), (), 0.0, (r"\brisk\b", r"\bmitigation\b"), ("certifications", "projects", "experience"), 0.72),
    SkillRule("Stakeholder Coordination", (), (), 0.0, (r"\bstakeholder\b",), ("objective", "projects", "certifications"), 0.74),
    SkillRule("Python", (r"\bpython\b",), ("skills", "projects", "experience", "coursework"), 0.97),
    SkillRule("FastAPI", (r"\bfastapi\b", r"\bfast\s*api\b"), ("skills", "projects", "experience"), 0.96),
    SkillRule("Java", (r"\bjava\b",), ("skills", "projects", "experience", "coursework"), 0.97),
    SkillRule("JavaScript", (r"\bjavascript\b", r"\bjs\b"), ("skills", "projects", "experience", "coursework"), 0.95),
    SkillRule("React", (r"\breact(?:\.js)?\b",), ("skills", "projects", "experience"), 0.95),
    SkillRule("SQL", (r"\bsql\b",), ("skills", "projects", "experience", "coursework"), 0.96),
    SkillRule("Git", (r"\bgit\b",), ("skills", "projects", "experience", "coursework"), 0.94),
    SkillRule("Excel", (r"\bexcel\b", r"\bmicrosoft excel\b"), ("skills", "projects", "experience"), 0.93),
)

ROLE_RULES: tuple[RoleRule, ...] = (
    RoleRule(
        "Project Coordinator",
        (r"\bproject coordinator\b", r"\bproject management\b", r"\baspiring project manager\b"),
        (r"\bgoogle project management certification\b", r"\bproject management certification\b"),
        ("Project Management", "Project Coordination", "Leadership", "Communication", "Coordination"),
        (r"\bcoordination\b", r"\bplanning\b", r"\btimeline\b", r"\bevent\b"),
        (r"\bleadership\b", r"\bteam\b", r"\bclub\b", r"\bevent\b"),
        (r"\boperations\b", r"\bmanagement\b"),
    ),
    RoleRule(
        "Project Manager",
        (r"\bproject manager\b", r"\bproject management\b", r"\baspiring project manager\b"),
        (r"\bgoogle project management certification\b", r"\bproject management certification\b"),
        ("Project Management", "Leadership", "Communication", "Stakeholder Handling", "Presentation"),
        (r"\bmanaged\b", r"\bplanning\b", r"\bexecution\b", r"\bprototype\b"),
        (r"\bled\b", r"\bleadership\b", r"\bpresident\b"),
        (r"\bmanagement\b",),
    ),
    RoleRule(
        "Program Coordinator",
        (r"\bprogram coordinator\b", r"\bprogram management\b"),
        (r"\bgoogle project management certification\b", r"\bproject management certification\b"),
        ("Program Coordination", "Project Coordination", "Communication", "Leadership"),
        (r"\bprogram\b", r"\bcoordination\b", r"\bevent\b"),
        (r"\bclub\b", r"\borgan(?:ized|iser)\b", r"\bleadership\b"),
        (r"\boperations\b",),
    ),
    RoleRule(
        "Operations Analyst",
        (r"\boperations analyst\b", r"\boperations\b", r"\bbusiness operations\b"),
        (r"\bproject management certification\b",),
        ("Operations", "Communication", "Coordination", "Documentation"),
        (r"\bprocess\b", r"\boperations\b", r"\banalysis\b", r"\bcoordination\b", r"\bevent\b"),
        (r"\bleadership\b", r"\bteam\b", r"\bcoordinator\b"),
        (r"\banalytics\b", r"\boperations\b"),
    ),
    RoleRule(
        "Business Operations Associate",
        (r"\bbusiness operations associate\b", r"\bbusiness operations\b", r"\boperations\b"),
        (r"\bproject management certification\b",),
        ("Operations", "Communication", "Coordination", "Documentation"),
        (r"\bprocess\b", r"\bcoordination\b", r"\bdocumentation\b"),
        (r"\bteam\b", r"\bevent\b"),
        (r"\boperations\b", r"\bbusiness\b"),
    ),
    RoleRule(
        "Operations Coordinator",
        (r"\boperations coordinator\b", r"\bproject coordination\b", r"\bcoordination\b"),
        (r"\bgoogle project management certification\b", r"\bproject management certification\b"),
        ("Coordination", "Communication", "Leadership", "Project Coordination"),
        (r"\boperations\b", r"\bcoordination\b", r"\bplanning\b", r"\btracking\b"),
        (r"\bevent\b", r"\bleadership\b", r"\bteam\b"),
        (r"\boperations\b", r"\bmanagement\b"),
    ),
    RoleRule(
        "PMO Analyst",
        (r"\bpmo\b", r"\bproject management office\b"),
        (r"\bproject management certification\b",),
        ("Project Management", "Documentation", "Coordination"),
        (r"\bdashboard\b", r"\btracking\b", r"\breporting\b"),
        (r"\bteam\b",),
        (r"\bmanagement\b",),
    ),
    RoleRule(
        "Backend Developer",
        (r"\bbackend developer\b", r"\bpython developer\b"),
        (),
        ("Python", "FastAPI", "SQL", "Git"),
        (r"\bapi\b", r"\bbackend\b", r"\bservice\b"),
        (),
        (r"\bcomputer science\b",),
    ),
)


class ResumeAnalysisService:
    def __init__(self) -> None:
        self.section_parser = ResumeSectionParser()
        self.job_matcher = JobMatcher()

    def analyze(self, raw_text: str, location: str = "India") -> dict[str, Any]:
        logger.info("LIVE ANALYZER PATH RUNNING")
        normalized_text = self._normalize_text(raw_text)
        parsed_sections = self.section_parser.parse(normalized_text)
        sections = self._clean_sections(parsed_sections.sections)

        explicit_skills = self.extract_explicit_skills(sections)
        inferred_skills = self.extract_inferred_skills(sections, explicit_skills)
        certifications = self.extract_certifications(sections)
        projects = self.extract_projects(sections, explicit_skills, inferred_skills)
        education = self.extract_education(sections)
        languages = self.extract_languages(normalized_text)
        years_of_experience = self.estimate_years_of_experience(normalized_text)
        experience_level = self.infer_experience_level(normalized_text, years_of_experience)
        recommended_roles = self.infer_roles(
            sections=sections,
            explicit_skills=explicit_skills,
            certifications=certifications,
        )
        similar_job_matches = self.job_matcher.match_jobs(
            recommended_roles=recommended_roles,
            explicit_skills=explicit_skills,
            inferred_skills=inferred_skills,
            certifications=certifications,
            projects=projects,
            experience_level=experience_level,
            location=location,
        )
        career_score = self.compute_career_score(explicit_skills, inferred_skills, recommended_roles, certifications, projects)
        market_demand = self.compute_market_demand(recommended_roles)
        ai_risk = self.compute_ai_risk(recommended_roles)
        time_to_hire_weeks = self.estimate_time_to_hire(recommended_roles, experience_level)

        result = {
            "raw_text": normalized_text,
            "sections": sections,
            "skills": [item["name"] for item in explicit_skills],
            "explicit_skills": explicit_skills,
            "inferred_skills": inferred_skills,
            "analyzer_version": "live-pipeline-v2",
            "inferred_roles": [item["title"] for item in recommended_roles],
            "recommended_roles": recommended_roles,
            "experience_level": experience_level,
            "years_of_experience": years_of_experience,
            "education": education,
            "certifications": certifications,
            "projects": projects,
            "languages": languages,
            "resume_score": self.compute_resume_score(explicit_skills, certifications, projects, sections),
            "career_score": career_score,
            "market_demand": market_demand,
            "ai_risk": ai_risk,
            "time_to_hire_weeks": time_to_hire_weeks,
            "similar_job_matches": similar_job_matches,
        }
        logger.info(
            "resume_analysis_complete explicit=%s inferred=%s roles=%s jobs=%s objective=%s",
            [item["name"] for item in explicit_skills],
            [item["name"] for item in inferred_skills],
            [item["title"] for item in recommended_roles],
            [item["role"] for item in similar_job_matches],
            sections.get("objective", "")[:180],
        )
        return result

    def extract_explicit_skills(self, sections: dict[str, str]) -> list[dict[str, Any]]:
        signals: list[dict[str, Any]] = []
        for rule in SKILL_RULES:
            best: dict[str, Any] | None = None
            for section_name, section_text in sections.items():
                if section_name not in rule.explicit_sections:
                    continue
                if self._matches_any(section_text, rule.patterns):
                    confidence = min(rule.explicit_confidence * SECTION_WEIGHTS.get(section_name, 0.4) + 0.10, 0.99)
                    confidence += self._explicit_context_bonus(rule.name, section_name, section_text)
                    confidence -= self._explicit_false_positive_penalty(rule.name, section_name, section_text)
                    candidate = {
                        "name": rule.name,
                        "confidence": round(max(min(confidence, 0.99), 0.0), 2),
                        "source": "explicit",
                        "section": section_name,
                    }
                    if best is None or candidate["confidence"] > best["confidence"]:
                        best = candidate
            if best and best["confidence"] >= self._explicit_threshold(rule.name):
                signals.append(best)
        return sorted(signals, key=lambda item: (-item["confidence"], item["name"]))

    def extract_inferred_skills(
        self,
        sections: dict[str, str],
        explicit_skills: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        explicit_names = {item["name"] for item in explicit_skills}
        inferred: list[dict[str, Any]] = []
        for rule in SKILL_RULES:
            if rule.name in explicit_names or not rule.inferred_patterns:
                continue
            best: dict[str, Any] | None = None
            for section_name, section_text in sections.items():
                if section_name not in rule.inferred_sections:
                    continue
                if self._matches_any(section_text, rule.inferred_patterns):
                    confidence = min(rule.inferred_confidence * SECTION_WEIGHTS.get(section_name, 0.35) + 0.18, 0.85)
                    confidence += self._inferred_context_bonus(rule.name, section_name, section_text)
                    candidate = {
                        "name": rule.name,
                        "confidence": round(max(min(confidence, 0.85), 0.0), 2),
                        "source": "inferred",
                        "section": section_name,
                    }
                    if best is None or candidate["confidence"] > best["confidence"]:
                        best = candidate
            if best and best["confidence"] >= 0.55:
                inferred.append(best)
        return sorted(inferred, key=lambda item: (-item["confidence"], item["name"]))

    def infer_roles(
        self,
        *,
        sections: dict[str, str],
        explicit_skills: list[dict[str, Any]],
        certifications: list[str],
    ) -> list[dict[str, Any]]:
        explicit_names = {item["name"] for item in explicit_skills}
        certification_text = " ".join(certifications).lower()
        recommendations: list[dict[str, Any]] = []

        for rule in ROLE_RULES:
            component_scores = {
                "objective": self._section_pattern_score(sections.get("objective", ""), rule.objective_patterns),
                "certifications": self._pattern_score(certification_text, rule.certification_patterns),
                "explicit_skills": self._skill_alignment_score(explicit_names, rule.explicit_skills),
                "projects": self._section_pattern_score(sections.get("projects", ""), rule.project_patterns),
                "extracurricular": self._section_pattern_score(sections.get("extracurricular", ""), rule.extracurricular_patterns),
                "coursework": self._section_pattern_score(sections.get("coursework", ""), rule.coursework_patterns),
            }
            score = sum(component_scores[name] * ROLE_COMPONENT_WEIGHTS[name] for name in ROLE_COMPONENT_WEIGHTS)
            score += self._role_priority_boost(rule.title, sections, explicit_names, certification_text)
            if score < 0.22:
                continue
            reason = self._build_role_reason(rule.title, sections, explicit_names, certifications, component_scores)
            recommendations.append(
                {
                    "title": rule.title,
                    "score": round(min(score, 0.99), 2),
                    "reason": reason,
                }
            )

        recommendations.sort(key=lambda item: item["score"], reverse=True)
        return recommendations[:5]

    def extract_education(self, sections: dict[str, str]) -> list[dict[str, str | None]]:
        education_text = sections.get("education", "")
        items: list[dict[str, str | None]] = []
        for line in self._candidate_lines(education_text):
            lower = line.lower()
            if not any(keyword in lower for keyword in DEGREE_KEYWORDS):
                continue
            degree_match = re.search(
                r"(b\.tech|b\.e|bachelor(?: of [a-z &]+)?|m\.tech|m\.e|master(?: of [a-z &]+)?|mba|b\.sc|m\.sc|phd[^,\n]*)",
                line,
                flags=re.IGNORECASE,
            )
            institution_match = re.search(r"(?:at|from|-)\s*([A-Z][A-Za-z0-9&.,()' -]{3,})", line)
            year_match = re.search(r"\b(19|20)\d{2}\b", line)
            items.append(
                {
                    "degree": degree_match.group(1).strip() if degree_match else line.strip(),
                    "institution": institution_match.group(1).strip() if institution_match else None,
                    "field_of_study": None,
                    "graduation_year": year_match.group(0) if year_match else None,
                }
            )
        return self._dedupe_dicts(items)

    def extract_certifications(self, sections: dict[str, str]) -> list[str]:
        certification_text = "\n".join(
            value for key, value in sections.items() if key in {"certifications", "education", "objective"}
        )
        results: list[str] = []
        certification_patterns = (
            r"\bgoogle project management: professional certificate\b",
            r"\bgoogle project management certification\b",
            r"\bproject management certification\b",
            r"\baws certified [a-z ]+\b",
            r"\bmicrosoft certified [a-z ]+\b",
            r"\bgoogle [a-z ]+ certification\b",
            r"\bcertified [a-z ]+\b",
            r"\b[pP]MP\b",
            r"\b[Cc]SM\b",
        )
        for pattern in certification_patterns:
            for match in re.findall(pattern, certification_text, flags=re.IGNORECASE):
                cleaned = re.sub(r"\s+", " ", match).strip(" -,:")
                title = self._normalize_certification_title(cleaned)
                if title not in results:
                    results.append(title)
        if "Google Project Management Professional Certificate" in results:
            results = [item for item in results if item != "Certified through Google"]
        return results

    def extract_projects(
        self,
        sections: dict[str, str],
        explicit_skills: list[dict[str, Any]],
        inferred_skills: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        explicit_names = {item["name"] for item in explicit_skills}
        inferred_names = {item["name"] for item in inferred_skills}
        project_text = sections.get("projects", "")
        projects: list[dict[str, Any]] = []
        for line in self._candidate_lines(project_text):
            if len(line) < 12:
                continue
            if not re.search(r"\b(project|developed|built|created|coordinat(?:ed|ing)|managed|organized|led|prototype)\b", line, flags=re.IGNORECASE):
                continue
            name_match = re.match(r"([A-Z][A-Za-z0-9 .:_-]{2,60})", line)
            tech_stack = sorted(
                skill for skill in explicit_names | inferred_names
                if re.search(rf"\b{re.escape(skill)}\b", line, flags=re.IGNORECASE)
            )
            projects.append(
                {
                    "name": name_match.group(1).strip(" :-") if name_match else line[:60].strip(),
                    "tech_stack": tech_stack,
                    "summary": line[:260].strip(),
                }
            )
        return self._dedupe_dicts(projects[:5])

    def extract_languages(self, text: str) -> list[str]:
        found: list[str] = []
        for language in LANGUAGE_CANDIDATES:
            if re.search(rf"\b{re.escape(language)}\b", text, flags=re.IGNORECASE):
                found.append(language)
        return found

    def estimate_years_of_experience(self, text: str) -> float:
        matches = []
        for pattern in (
            r"(\d+(?:\.\d+)?)\+?\s*(?:years|year|yrs|yr)\s+of\s+experience",
            r"experience\s+of\s+(\d+(?:\.\d+)?)\+?\s*(?:years|year|yrs|yr)",
            r"(\d+(?:\.\d+)?)\+?\s*(?:years|year|yrs|yr)\s+experience",
        ):
            matches.extend(float(match) for match in re.findall(pattern, text, flags=re.IGNORECASE))
        if matches:
            return round(max(matches), 1)
        if re.search(r"\b(fresher|student|entry level|graduate|intern)\b", text, flags=re.IGNORECASE):
            return 0.0
        return 0.0

    def infer_experience_level(self, text: str, years_of_experience: float) -> str:
        if years_of_experience >= 5 or re.search(r"\bsenior\b", text, flags=re.IGNORECASE):
            return "senior"
        if years_of_experience >= 2 or re.search(r"\bmid\b", text, flags=re.IGNORECASE):
            return "mid"
        if years_of_experience > 0 or re.search(r"\bjunior\b", text, flags=re.IGNORECASE):
            return "junior"
        return "fresher"

    def compute_resume_score(
        self,
        explicit_skills: list[dict[str, Any]],
        certifications: list[str],
        projects: list[dict[str, Any]],
        sections: dict[str, str],
    ) -> float:
        score = 0.0
        score += min(len(explicit_skills), 6) / 6 * 0.30
        score += 0.20 if sections.get("objective") else 0.0
        score += 0.15 if sections.get("education") else 0.0
        score += min(len(certifications), 2) / 2 * 0.15
        score += min(len(projects), 3) / 3 * 0.15
        score += 0.05 if re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", "\n".join(sections.values())) else 0.0
        return round(min(score, 1.0), 2)

    def _clean_sections(self, sections: dict[str, str]) -> dict[str, str]:
        cleaned = dict(sections)
        objective_lines = [
            line for line in self._candidate_lines(cleaned.get("objective", ""))
            if not self._looks_like_contact_line(line)
        ]
        if objective_lines:
            cleaned["objective"] = "\n".join(objective_lines).strip()
        return cleaned

    def compute_career_score(
        self,
        explicit_skills: list[dict[str, Any]],
        inferred_skills: list[dict[str, Any]],
        recommended_roles: list[dict[str, Any]],
        certifications: list[str],
        projects: list[dict[str, Any]],
    ) -> int:
        score = 40
        score += min(len(explicit_skills), 5) * 5
        score += min(len(inferred_skills), 3) * 2
        score += min(len(recommended_roles), 3) * 4
        score += min(len(certifications), 2) * 4
        score += min(len(projects), 2) * 3
        return min(score, 100)

    @staticmethod
    def compute_market_demand(recommended_roles: list[dict[str, Any]]) -> int:
        if not recommended_roles:
            return 50
        top_role = recommended_roles[0]["title"]
        if top_role in {"Project Coordinator", "Project Manager", "Program Coordinator"}:
            return 68
        if top_role in {"Operations Analyst", "Business Operations Associate"}:
            return 64
        return 58

    @staticmethod
    def compute_ai_risk(recommended_roles: list[dict[str, Any]]) -> int:
        if not recommended_roles:
            return 50
        top_role = recommended_roles[0]["title"]
        if top_role in {"Project Coordinator", "Project Manager", "Program Coordinator"}:
            return 42
        if top_role in {"Operations Analyst", "Business Operations Associate"}:
            return 46
        return 38

    @staticmethod
    def estimate_time_to_hire(recommended_roles: list[dict[str, Any]], experience_level: str) -> list[int]:
        if experience_level == "fresher":
            if recommended_roles and recommended_roles[0]["title"] in {"Project Coordinator", "Program Coordinator"}:
                return [10, 20]
            return [12, 24]
        return [8, 16]

    @staticmethod
    def _normalize_text(value: str) -> str:
        value = value.replace("\x00", " ")
        value = re.sub(r"\r\n?", "\n", value)
        value = re.sub(r"[ \t]+", " ", value)
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value.strip()

    @staticmethod
    def _matches_any(text: str, patterns: tuple[str, ...]) -> bool:
        return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)

    @staticmethod
    def _pattern_score(text: str, patterns: tuple[str, ...]) -> float:
        if not text or not patterns:
            return 0.0
        hits = sum(1 for pattern in patterns if re.search(pattern, text, flags=re.IGNORECASE))
        return min(hits / max(len(patterns), 1), 1.0)

    def _section_pattern_score(self, text: str, patterns: tuple[str, ...]) -> float:
        return self._pattern_score(text, patterns)

    @staticmethod
    def _skill_alignment_score(actual_skills: set[str], expected_skills: tuple[str, ...]) -> float:
        if not expected_skills:
            return 0.0
        return min(len(actual_skills.intersection(expected_skills)) / len(expected_skills), 1.0)

    def _build_role_reason(
        self,
        title: str,
        sections: dict[str, str],
        explicit_names: set[str],
        certifications: list[str],
        component_scores: dict[str, float],
    ) -> str:
        reasons: list[str] = []
        if component_scores["objective"] >= 0.5:
            reasons.append(self._objective_reason(title, sections.get("objective", "")))
        if component_scores["certifications"] >= 0.5:
            reasons.append(self._certification_reason(certifications))
        supported_skills = [
            skill for skill in explicit_names
            if skill in {
                "Project Management", "Project Coordination", "Program Coordination", "Leadership",
                "Communication", "Stakeholder Handling", "Operations", "Coordination",
                "Event Coordination", "Presentation",
            }
        ]
        if supported_skills:
            reasons.append(f"explicit evidence includes {', '.join(sorted(supported_skills)[:4])}")
        if component_scores["projects"] >= 0.5:
            reasons.append(self._project_reason(sections.get("projects", "")))
        if component_scores["extracurricular"] >= 0.4:
            reasons.append("leadership and coordination activity outside academics supports the match")

        if "Project Manager" == title and sections.get("experience", "") == "":
            reasons.append("formal hands-on PM experience is still limited, so coordinator-track roles may be more immediate")
        if title == "Operations Analyst" and "Operations" not in explicit_names:
            reasons.append("operations tooling evidence remains moderate compared with coordination evidence")

        return "; ".join(reasons) or "Matched from section-aware role evidence across objective, skills, and projects."

    @staticmethod
    def _explicit_threshold(skill_name: str) -> float:
        if skill_name in {"Git", "SQL", "Python", "Java", "JavaScript", "React", "FastAPI"}:
            return 0.8
        return 0.55

    @staticmethod
    def _explicit_context_bonus(skill_name: str, section_name: str, section_text: str) -> float:
        lower = section_text.lower()
        if section_name in {"skills", "strengths"}:
            return 0.08
        if skill_name in {"Project Management", "Project Coordination", "Program Coordination"} and (
            "aspiring project manager" in lower or "project coordinator" in lower
        ):
            return 0.08
        if skill_name == "Communication" and "communication skill" in lower:
            return 0.06
        if skill_name == "Leadership" and re.search(r"\bleadership skills?\b", lower):
            return 0.06
        if skill_name == "Stakeholder Handling" and "stakeholder" in lower:
            return 0.04
        return 0.0

    @staticmethod
    def _explicit_false_positive_penalty(skill_name: str, section_name: str, section_text: str) -> float:
        lower = section_text.lower()
        if skill_name == "Git" and section_name != "skills" and "github" not in lower:
            return 0.12
        if skill_name == "SQL" and section_name not in {"skills", "coursework"}:
            return 0.14
        if skill_name in {"Python", "Java", "JavaScript", "React", "FastAPI"} and section_name == "objective":
            return 0.18
        return 0.0

    @staticmethod
    def _inferred_context_bonus(skill_name: str, section_name: str, section_text: str) -> float:
        lower = section_text.lower()
        if section_name == "certifications" and "project management" in lower and skill_name in {"Agile", "Scrum", "Risk Assessment", "Stakeholder Coordination"}:
            return 0.08
        if section_name == "projects" and skill_name in {"Stakeholder Coordination", "Risk Assessment"}:
            return 0.04
        return 0.0

    @staticmethod
    def _role_priority_boost(
        title: str,
        sections: dict[str, str],
        explicit_names: set[str],
        certification_text: str,
    ) -> float:
        objective_text = sections.get("objective", "").lower()
        projects_text = sections.get("projects", "").lower()
        extracurricular_text = sections.get("extracurricular", "").lower()
        boost = 0.0

        pm_signal = (
            "aspiring project manager" in objective_text or
            "project management" in objective_text or
            "project manager" in objective_text
        )
        has_pm_cert = "project management" in certification_text or "google project management" in certification_text
        coordination_evidence = any(
            skill in explicit_names
            for skill in {"Project Management", "Project Coordination", "Coordination", "Leadership", "Communication", "Event Coordination"}
        )

        if title in PM_FAMILY_ROLES and pm_signal:
            boost += 0.12
        if title in PM_FAMILY_ROLES and has_pm_cert:
            boost += 0.08
        if title in {"Project Coordinator", "Project Manager", "Program Coordinator", "Operations Coordinator"} and coordination_evidence:
            boost += 0.06
        if title in {"Project Coordinator", "Program Coordinator"} and (
            "event" in projects_text or "event" in extracurricular_text or "coordination" in projects_text
        ):
            boost += 0.05
        if title == "Operations Analyst" and "Operations" not in explicit_names:
            boost -= 0.03
        if title == "Operations Analyst" and has_pm_cert and coordination_evidence:
            boost += 0.03
        if title == "Backend Developer" and not {"Python", "FastAPI", "Git", "SQL"} & explicit_names:
            boost -= 0.30

        return boost

    @staticmethod
    def _objective_reason(title: str, objective_text: str) -> str:
        lower = objective_text.lower()
        if "aspiring project manager" in lower:
            return "objective directly states an aspiring Project Manager goal"
        if "project management" in lower or "project manager" in lower:
            return f"objective is closely aligned with {title}"
        return "objective or summary alignment is strong"

    @staticmethod
    def _certification_reason(certifications: list[str]) -> str:
        for certification in certifications:
            if "project management" in certification.lower():
                return f"certification evidence includes {certification}"
        return "relevant certification evidence is present"

    @staticmethod
    def _project_reason(project_text: str) -> str:
        lower = project_text.lower()
        if "event" in lower and "coordination" in lower:
            return "project descriptions show event and coordination ownership"
        if "prototype" in lower or "ai" in lower or "no-code" in lower:
            return "projects show delivery ownership through practical prototyping work"
        return "project descriptions reinforce the role fit"

    @staticmethod
    def _looks_like_contact_line(line: str) -> bool:
        return (
            "@" in line or
            "linkedin" in line.lower() or
            "www." in line.lower() or
            bool(re.search(r"\+?\d[\d\s-]{7,}", line))
        )

    @staticmethod
    def _normalize_certification_title(value: str) -> str:
        lowered = value.lower()
        if "google project management" in lowered:
            return "Google Project Management Professional Certificate"
        return value[:1].upper() + value[1:]

    @staticmethod
    def _candidate_lines(text: str) -> list[str]:
        lines = [line.strip(" -*\t") for line in text.splitlines()]
        return [line for line in lines if len(line) >= 4]

    @staticmethod
    def _dedupe_dicts(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        deduped: list[dict[str, Any]] = []
        seen: set[str] = set()
        for item in items:
            key = repr(sorted((field, repr(value)) for field, value in item.items()))
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped
