import json
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple


BASE_DIR = Path(__file__).resolve().parent
LOCAL_DATA_DIR = BASE_DIR / ".local-data"
LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = LOCAL_DATA_DIR / "resume_guard.db"

COMMON_SKILLS = [
    "python", "java", "javascript", "typescript", "react", "node", "node.js",
    "spring", "spring boot", "sql", "postgresql", "mysql", "mongodb", "docker",
    "kubernetes", "aws", "azure", "html", "css", "tailwind", "figma", "seo",
    "analytics", "power bi", "tableau", "excel", "machine learning", "fastapi",
    "communication", "leadership", "problem solving", "teamwork", "testing",
    "rest api", "git", "ci/cd",
]

ROLE_PROFILES = [
    {
        "role_key": "frontend",
        "role_title": "Frontend Developer",
        "family": "software",
        "keywords": ["react", "javascript", "typescript", "css", "html", "ui", "frontend", "tailwind"],
    },
    {
        "role_key": "backend",
        "role_title": "Backend Developer",
        "family": "software",
        "keywords": ["java", "spring", "python", "api", "backend", "sql", "microservices", "fastapi"],
    },
    {
        "role_key": "data",
        "role_title": "Data Analyst",
        "family": "data",
        "keywords": ["python", "sql", "excel", "tableau", "power bi", "analytics", "dashboard", "statistics"],
    },
    {
        "role_key": "design",
        "role_title": "UI/UX Designer",
        "family": "design",
        "keywords": ["figma", "wireframe", "prototype", "ux", "ui", "research", "usability", "design system"],
    },
    {
        "role_key": "marketing",
        "role_title": "Digital Marketing Specialist",
        "family": "marketing",
        "keywords": ["seo", "campaign", "content", "crm", "marketing", "analytics", "brand"],
    },
    {
        "role_key": "business",
        "role_title": "Operations Analyst",
        "family": "business",
        "keywords": ["operations", "stakeholder", "coordination", "reporting", "process", "business", "project"],
    },
]

POSITIVE_TERMS = [
    ("experience", 8), ("work experience", 8), ("professional experience", 8),
    ("employment", 7), ("education", 7), ("skills", 8), ("technical skills", 8),
    ("projects", 7), ("certifications", 6), ("summary", 5), ("objective", 4),
    ("resume", 3), ("curriculum vitae", 4), ("linkedin.com/in", 6),
    ("gmail.com", 5), ("outlook.com", 5), ("phone", 4), ("email", 4),
]

NEGATIVE_TERMS = [
    ("pitch deck", 14), ("investor deck", 14), ("series a", 11), ("fundraising", 11),
    ("tam", 9), ("sam", 9), ("som", 9), ("go to market", 8), ("market size", 8),
    ("revenue projection", 10), ("youtube", 14), ("subscribe", 10), ("thumbnail", 12),
    ("watch time", 10), ("channel", 7), ("video", 7), ("screenshot", 12),
    ("slide", 6), ("agenda", 7), ("speaker notes", 8), ("seed round", 9),
    ("pitch", 8), ("deck", 7), ("presentation", 8), ("powerpoint", 8),
    ("ppt", 7), ("pptx", 7), ("cap table", 10), ("burn rate", 10),
    ("views", 8), ("subscribers", 10), ("watch later", 10), ("play button", 10),
    ("recommended videos", 11), ("like share subscribe", 14), ("screengrab", 12),
]

ACTION_VERBS = {
    "developed", "built", "designed", "implemented", "managed", "led", "improved",
    "optimized", "launched", "delivered", "created", "collaborated", "analyzed",
}

SECTION_PATTERNS = {
    "experience": re.compile(r"\b(experience|employment|work history)\b", re.I),
    "education": re.compile(r"\b(education|academic)\b", re.I),
    "skills": re.compile(r"\b(skills|technical skills|core competencies)\b", re.I),
    "projects": re.compile(r"\b(projects|portfolio)\b", re.I),
    "summary": re.compile(r"\b(summary|objective|profile)\b", re.I),
    "certifications": re.compile(r"\b(certifications|certificates|licenses)\b", re.I),
}


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_resume_guard_db() -> None:
    conn = _connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS signal_terms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term TEXT NOT NULL,
                category TEXT NOT NULL,
                weight INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS role_profiles (
                role_key TEXT PRIMARY KEY,
                role_title TEXT NOT NULL,
                family TEXT NOT NULL,
                keywords_json TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS resume_guard_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                filename TEXT,
                accepted INTEGER NOT NULL,
                score REAL NOT NULL,
                detected_role TEXT,
                detected_family TEXT,
                summary_json TEXT NOT NULL
            )
            """
        )

        signal_count = conn.execute("SELECT COUNT(*) FROM signal_terms").fetchone()[0]
        if signal_count == 0:
            conn.executemany(
                "INSERT INTO signal_terms (term, category, weight) VALUES (?, ?, ?)",
                [(term, "positive", weight) for term, weight in POSITIVE_TERMS]
                + [(term, "negative", weight) for term, weight in NEGATIVE_TERMS],
            )

        role_count = conn.execute("SELECT COUNT(*) FROM role_profiles").fetchone()[0]
        if role_count == 0:
            conn.executemany(
                "INSERT INTO role_profiles (role_key, role_title, family, keywords_json) VALUES (?, ?, ?, ?)",
                [
                    (
                        profile["role_key"],
                        profile["role_title"],
                        profile["family"],
                        json.dumps(profile["keywords"]),
                    )
                    for profile in ROLE_PROFILES
                ],
            )
        conn.commit()
    finally:
        conn.close()


def _load_signals(category: str) -> List[Tuple[str, int]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT term, weight FROM signal_terms WHERE category = ? ORDER BY weight DESC, term ASC",
            (category,),
        ).fetchall()
        return [(str(row["term"]), int(row["weight"])) for row in rows]
    finally:
        conn.close()


def _load_role_profiles() -> List[Dict[str, object]]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT role_key, role_title, family, keywords_json FROM role_profiles ORDER BY role_title ASC"
        ).fetchall()
        return [
            {
                "role_key": str(row["role_key"]),
                "role_title": str(row["role_title"]),
                "family": str(row["family"]),
                "keywords": json.loads(str(row["keywords_json"])),
            }
            for row in rows
        ]
    finally:
        conn.close()


def extract_skills(text: str, limit: int = 10) -> List[str]:
    lowered = f" {normalize_text(text).lower()} "
    found: List[str] = []
    for skill in sorted(COMMON_SKILLS, key=len, reverse=True):
        if f" {skill.lower()} " in lowered or re.search(rf"\b{re.escape(skill.lower())}\b", lowered):
            pretty = skill.title()
            if pretty not in found:
                found.append(pretty)
        if len(found) >= limit:
            break
    return found


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _collect_section_hits(text: str) -> List[str]:
    return [name for name, pattern in SECTION_PATTERNS.items() if pattern.search(text)]


def _extract_candidate_lines(text: str) -> List[str]:
    return [line.strip() for line in (text or "").splitlines() if line.strip()]


def _count_resume_date_ranges(text: str) -> int:
    patterns = [
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\s*[-–]\s*(?:present|current|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2})\b",
        r"\b(?:19|20)\d{2}\s*[-–]\s*(?:present|current|(?:19|20)\d{2})\b",
    ]
    return sum(len(re.findall(pattern, text, re.I)) for pattern in patterns)


def _count_heading_like_lines(lines: List[str]) -> int:
    count = 0
    for line in lines:
        compact = re.sub(r"[^A-Za-z ]", "", line).strip()
        if not compact:
            continue
        if compact.upper() != compact:
            continue
        if len(compact.split()) <= 5 and any(ch.isalpha() for ch in compact):
            count += 1
    return count


def _looks_like_image_or_slide_dump(lines: List[str], normalized: str) -> bool:
    if not lines:
        return True

    short_lines = sum(1 for line in lines if len(line.split()) <= 4)
    alpha_light_lines = sum(1 for line in lines if len(re.findall(r"[A-Za-z]", line)) < 8)
    has_resume_sections = len(_collect_section_hits(normalized)) >= 2

    return (
        len(lines) >= 6
        and short_lines / len(lines) >= 0.55
        and alpha_light_lines / len(lines) >= 0.4
        and not has_resume_sections
    )


def _detect_role(text: str, skills: List[str]) -> Dict[str, object]:
    evidence = f"{text.lower()} {' '.join(skill.lower() for skill in skills)}"
    best_profile = {
        "role_key": "backend",
        "role_title": "Backend Developer",
        "family": "software",
        "keywords": [],
        "score": 0,
    }
    for profile in _load_role_profiles():
        score = 0
        for keyword in profile["keywords"]:
            score += evidence.count(str(keyword).lower())
        if score > best_profile["score"]:
            best_profile = {**profile, "score": score}
    return best_profile


def evaluate_resume_text(text: str, filename: str = "") -> Dict[str, object]:
    ensure_resume_guard_db()

    normalized = normalize_text(text)
    lowered = normalized.lower()
    raw_lines = _extract_candidate_lines(text)
    positive_hits: List[Dict[str, object]] = []
    negative_hits: List[Dict[str, object]] = []

    positive_score = 0
    for term, weight in _load_signals("positive"):
        if term in lowered:
            positive_score += weight
            positive_hits.append({"term": term, "weight": weight})

    negative_score = 0
    for term, weight in _load_signals("negative"):
        if term in lowered or term in filename.lower():
            negative_score += weight
            negative_hits.append({"term": term, "weight": weight})

    section_hits = _collect_section_hits(normalized)
    skills = extract_skills(normalized)
    contact_signals = sum(
        1
        for pattern in [
            r"[\w\.-]+@[\w\.-]+\.[A-Za-z]{2,}",
            r"(?:\+?\d[\d\-\s()]{8,}\d)",
            r"linkedin\.com/in/",
        ]
        if re.search(pattern, normalized, re.I)
    )
    bullet_count = len(re.findall(r"(?:^|\s)[\-\u2022*]\s", text))
    year_mentions = len(re.findall(r"\b(?:19|20)\d{2}\b", normalized))
    date_ranges = _count_resume_date_ranges(normalized)
    heading_lines = _count_heading_like_lines(raw_lines)
    action_verb_hits = sum(1 for verb in ACTION_VERBS if re.search(rf"\b{re.escape(verb)}\b", lowered))
    role_profile = _detect_role(normalized, skills)
    image_or_slide_dump = _looks_like_image_or_slide_dump(raw_lines, normalized)

    structure_score = len(section_hits) * 8
    contact_score = contact_signals * 9
    content_score = (
        min(len(skills), 6) * 4
        + min(action_verb_hits, 5) * 3
        + min(year_mentions, 6) * 2
        + min(date_ranges, 4) * 4
        + min(heading_lines, 4) * 2
    )
    length_penalty = 0 if len(normalized) >= 180 else 18
    slide_penalty = 16 if image_or_slide_dump else 0
    score = positive_score + structure_score + contact_score + content_score - negative_score - length_penalty - slide_penalty

    accepted = (
        len(normalized) >= 180
        and len(section_hits) >= 2
        and contact_signals >= 1
        and (action_verb_hits >= 2 or date_ranges >= 1 or year_mentions >= 2 or bullet_count >= 3)
        and len(skills) >= 2
        and negative_score < 14
        and not image_or_slide_dump
        and score >= 34
    )

    reasons: List[str] = []
    if len(normalized) < 180:
        reasons.append("The document does not contain enough readable text for a resume.")
    if len(section_hits) < 2:
        reasons.append("Expected resume sections like experience, education, skills, or projects were not found.")
    if contact_signals < 1:
        reasons.append("Contact details such as email, phone, or LinkedIn were not detected.")
    if len(skills) < 2:
        reasons.append("The document does not include enough resume-like role or skill evidence.")
    if action_verb_hits < 2 and date_ranges < 1 and year_mentions < 2 and bullet_count < 3:
        reasons.append("Resume-style work history evidence was not detected.")
    if negative_score >= 14:
        reasons.append("The content looks more like a pitch deck, slide deck, screenshot, or video content than a resume.")
    if image_or_slide_dump:
        reasons.append("The extracted text looks like a screenshot, slide, or fragmented image capture instead of a resume.")

    if not reasons and not accepted:
        reasons.append("The document structure does not look like a professional resume.")

    summary = {
        "is_resume": accepted,
        "score": score,
        "section_hits": section_hits,
        "skills": skills,
        "positive_hits": positive_hits[:8],
        "negative_hits": negative_hits[:8],
        "contact_signals": contact_signals,
        "bullet_count": bullet_count,
        "year_mentions": year_mentions,
        "date_ranges": date_ranges,
        "heading_lines": heading_lines,
        "action_verb_hits": action_verb_hits,
        "image_or_slide_dump": image_or_slide_dump,
        "role_key": role_profile["role_key"],
        "target_role": role_profile["role_title"],
        "role_family": role_profile["family"],
        "reasons": reasons,
    }

    conn = _connect()
    try:
        conn.execute(
            """
            INSERT INTO resume_guard_events
                (filename, accepted, score, detected_role, detected_family, summary_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                filename,
                1 if accepted else 0,
                float(score),
                str(role_profile["role_title"]),
                str(role_profile["family"]),
                json.dumps(summary),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return summary
