from __future__ import annotations

from typing import Dict, List

from .common import normalize_text, request_json


def fetch_jobs(api_key: str, role: str, location: str, limit: int = 10) -> List[Dict[str, object]]:
    if not api_key:
        return []

    data = request_json(
        "POST",
        "https://google.serper.dev/search",
        headers={
            "X-API-KEY": api_key,
            "Content-Type": "application/json",
        },
        json={
            "q": f"{role} jobs in {location}",
            "gl": "in",
            "hl": "en",
            "num": max(limit, 10),
        },
    )

    jobs: List[Dict[str, object]] = []
    for item in data.get("organic", [])[:limit]:
        if not isinstance(item, dict):
            continue

        jobs.append(
            {
                "title": normalize_text(item.get("title")),
                "company": normalize_text(item.get("source")),
                "location": normalize_text(location),
                "salary": "Not specified",
                "description": normalize_text(item.get("snippet")),
                "apply_link": normalize_text(item.get("link")),
                "type": "Not specified",
                "posted": "Recently",
                "source": "serper",
            }
        )
    return jobs
