from __future__ import annotations

import re
from dataclasses import dataclass


SECTION_ALIASES: dict[str, tuple[str, ...]] = {
    "objective": ("objective", "summary", "professional summary", "career objective", "profile"),
    "education": ("education", "academic background", "academics"),
    "certifications": ("certifications", "licenses", "credentials"),
    "skills": ("skills", "technical skills", "core competencies", "strengths"),
    "projects": ("projects", "project", "academic projects", "personal projects"),
    "experience": ("experience", "work experience", "internship", "employment"),
    "extracurricular": (
        "extracurricular",
        "extra curricular",
        "extra curricular activities",
        "extracurricular activities",
        "activities",
        "leadership",
        "positions of responsibility",
        "volunteer",
    ),
    "coursework": ("coursework", "relevant coursework", "courses"),
    "strengths": ("strengths", "key strengths", "soft skills", "competencies"),
}

CANONICAL_SECTION_ORDER = (
    "objective",
    "education",
    "certifications",
    "skills",
    "projects",
    "experience",
    "extracurricular",
    "coursework",
    "strengths",
    "other",
)


@dataclass
class ResumeSections:
    sections: dict[str, str]
    lines_by_section: dict[str, list[str]]


class ResumeSectionParser:
    def parse(self, raw_text: str) -> ResumeSections:
        lines = [self._clean_line(line) for line in raw_text.splitlines()]
        lines = [line for line in lines if line]

        sections: dict[str, list[str]] = {name: [] for name in CANONICAL_SECTION_ORDER}
        current_section = "objective"
        seen_header = False

        for line in lines:
            header_section = self._match_section_header(line)
            if header_section:
                current_section = header_section
                seen_header = True
                continue

            if not seen_header and self._looks_like_heading(line):
                continue

            sections[current_section].append(line)

        flattened = {
            name: "\n".join(values).strip()
            for name, values in sections.items()
            if values
        }
        lines_by_section = {
            name: [value for value in values if value]
            for name, values in sections.items()
            if values
        }

        if "objective" not in flattened and lines:
            flattened["objective"] = "\n".join(lines[:4]).strip()
            lines_by_section["objective"] = lines[:4]

        return ResumeSections(sections=flattened, lines_by_section=lines_by_section)

    def _match_section_header(self, line: str) -> str | None:
        normalized = re.sub(r"[^a-z ]+", " ", line.lower())
        normalized = re.sub(r"\s+", " ", normalized).strip()
        for section, aliases in SECTION_ALIASES.items():
            if normalized in aliases:
                return section
        return None

    @staticmethod
    def _clean_line(line: str) -> str:
        line = line.replace("\x00", " ")
        line = re.sub(r"\s+", " ", line.strip(" \t-:*|"))
        return line.strip()

    @staticmethod
    def _looks_like_heading(line: str) -> bool:
        if len(line.split()) > 6:
            return False
        letters = re.sub(r"[^A-Za-z]", "", line)
        return bool(letters) and line == line.upper()
