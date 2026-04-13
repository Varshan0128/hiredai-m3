from __future__ import annotations

from typing import Dict, List
import re

from .common import (
    extract_body_text,
    extract_meta_content,
    extract_salary,
    normalize_text,
    request_json,
    request_text,
)


def search_jobs(api_key: str, role: str, location: str, limit: int = 10) -> List[Dict[str, object]]:
    if not api_key:
        return []

    data = request_json(
        "GET",
        "https://api.scrapingdog.com/google",
        params={
            "api_key": api_key,
            "query": f"{role} jobs in {location}",
        },
    )

    results = data.get("organic_results") or data.get("results") or []
    jobs: List[Dict[str, object]] = []
    for item in results[:limit]:
        if not isinstance(item, dict):
            continue

        jobs.append(
            {
                "title": normalize_text(item.get("title")),
                "company": normalize_text(item.get("displayed_link") or item.get("domain")),
                "location": normalize_text(location),
                "salary": extract_salary(item.get("snippet")),
                "description": normalize_text(item.get("snippet")),
                "apply_link": normalize_text(item.get("link")),
                "type": "Not specified",
                "posted": "Recently",
                "source": "scrapingdog",
            }
        )
    return jobs


def fetch_job_details(api_key: str, url: str) -> Dict[str, str]:
    if not api_key or not url:
        return {}
    if "linkedin.com/jobs" in url.lower():
        return {}

    html = request_text(
        "https://api.scrapingdog.com/scrape",
        params={
            "api_key": api_key,
            "dynamic": "false",
            "url": url,
        },
        timeout=8,
    )

    stripped = normalize_text(html)
    if stripped.startswith("{") and '"message"' in stripped:
        return {}

    meta_description = (
        extract_meta_content(html, "description")
        or extract_meta_content(html, "og:description")
        or extract_meta_content(html, "twitter:description")
    )
    body_text = extract_body_text(html)
    description = normalize_text(meta_description or body_text[:1200])

    location_match = re.search(
        r"\b(?:location|city|work location|job location)\b[:\s-]*([A-Za-z0-9,\- ]{3,60})",
        body_text,
        re.IGNORECASE,
    )

    return {
        "description": description,
        "salary": extract_salary(meta_description, body_text),
        "location": normalize_text(location_match.group(1)) if location_match else "",
    }
