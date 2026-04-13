from __future__ import annotations

from typing import Dict, List

from .common import extract_salary, normalize_text, pick_apply_link, request_json


def fetch_jobs(api_key: str, role: str, location: str, limit: int = 10) -> List[Dict[str, object]]:
    if not api_key:
        return []

    data = request_json(
        "GET",
        "https://serpapi.com/search.json",
        params={
            "engine": "google_jobs",
            "q": f"{role} jobs",
            "location": location,
            "hl": "en",
            "api_key": api_key,
        },
    )

    jobs: List[Dict[str, object]] = []
    for item in data.get("jobs_results", [])[:limit]:
        if not isinstance(item, dict):
            continue

        detected = item.get("detected_extensions")
        detected_extensions = detected if isinstance(detected, dict) else {}
        jobs.append(
            {
                "title": normalize_text(item.get("title")),
                "company": normalize_text(item.get("company_name") or item.get("via")),
                "location": normalize_text(item.get("location") or location),
                "salary": extract_salary(
                    detected_extensions.get("salary"),
                    " ".join(str(part) for part in item.get("extensions", []) if part),
                    item.get("description"),
                ),
                "description": normalize_text(item.get("description")),
                "apply_link": pick_apply_link(item),
                "type": normalize_text(
                    detected_extensions.get("schedule_type")
                    or ("Remote" if detected_extensions.get("work_from_home") else "")
                ) or "Not specified",
                "posted": normalize_text(detected_extensions.get("posted_at")) or "Recently",
                "source": "serpapi",
            }
        )
    return jobs
