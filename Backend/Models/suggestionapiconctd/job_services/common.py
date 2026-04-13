from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from typing import Dict, Iterable, List, Optional
import re
import time

import requests


DEFAULT_TIMEOUT = 10
MAX_RETRIES = 2
USER_AGENT = "YenJobDiscovery/1.0"


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def request_json(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, object]] = None,
    json: Optional[Dict[str, object]] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Dict[str, object]:
    merged_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.request(
                method,
                url,
                headers=merged_headers,
                params=params,
                json=json,
                timeout=timeout,
            )
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else 1.5 * (attempt + 1)
                time.sleep(delay)
                continue

            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                return data
            return {"items": data}
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(1.2 * (attempt + 1))

    raise RuntimeError(str(last_error or "Unknown request error"))


def request_text(
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, object]] = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> str:
    merged_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            response = requests.get(url, headers=merged_headers, params=params, timeout=timeout)
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else 1.5 * (attempt + 1)
                time.sleep(delay)
                continue

            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            last_error = exc
            if attempt < MAX_RETRIES - 1:
                time.sleep(1.2 * (attempt + 1))

    raise RuntimeError(str(last_error or "Unknown request error"))


def make_job_id(title: str, company: str, location: str) -> str:
    seed = f"{title}-{company}-{location}".lower()
    return re.sub(r"[^a-z0-9]+", "-", seed).strip("-")


def pick_apply_link(job: Dict[str, object]) -> str:
    candidates = [
        job.get("apply_link"),
        job.get("source_link"),
        job.get("link"),
        job.get("url"),
        job.get("share_link"),
        job.get("redirect_url"),
    ]

    apply_options = job.get("apply_options")
    if isinstance(apply_options, list):
        for option in apply_options:
            if isinstance(option, dict):
                candidates.append(option.get("link"))

    for candidate in candidates:
        value = normalize_text(candidate)
        if value.startswith("http://") or value.startswith("https://"):
            return value
    return ""


def extract_salary(*values: object) -> str:
    salary_pattern = re.compile(
        r"((?:[$€£₹]\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?(?:\s?[-–to]+\s?[$€£₹]?\s?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM])?)?(?:\s*(?:a year|per year|a month|per month|a week|per hour|an hour))?))"
    )

    for value in values:
        text = normalize_text(value)
        if not text:
            continue
        match = salary_pattern.search(text)
        if match:
            return normalize_text(match.group(1))
    return "Not specified"


def extract_body_text(html: str) -> str:
    if not html:
        return ""

    cleaned = re.sub(r"(?is)<(script|style|noscript).*?>.*?</\1>", " ", html)
    cleaned = re.sub(r"(?i)<br\s*/?>", " ", cleaned)
    cleaned = re.sub(r"(?is)</(p|div|li|section|article|h\d)>", " ", cleaned)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    return normalize_text(unescape(cleaned))


def extract_meta_content(html: str, key: str) -> str:
    pattern = re.compile(
        rf'<meta[^>]+(?:name|property)=["\']{re.escape(key)}["\'][^>]+content=["\'](.*?)["\']',
        re.IGNORECASE,
    )
    match = pattern.search(html)
    return normalize_text(unescape(match.group(1))) if match else ""


def dedupe_jobs(jobs: Iterable[Dict[str, object]], limit: int) -> List[Dict[str, object]]:
    deduped: List[Dict[str, object]] = []
    seen = set()

    for job in jobs:
        title = normalize_text(job.get("title"))
        company = normalize_text(job.get("company"))
        location = normalize_text(job.get("location"))
        apply_link = normalize_text(job.get("apply_link"))
        key = (
            title.lower(),
            company.lower(),
            location.lower(),
            apply_link.lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(job)
        if len(deduped) >= limit:
            break

    return deduped


def enrich_jobs_with_details(
    jobs: List[Dict[str, object]],
    detail_fetcher,
    api_key: str,
    *,
    max_workers: int = 4,
    max_jobs: int = 3,
) -> List[Dict[str, object]]:
    candidates = [
        job
        for job in jobs
        if normalize_text(job.get("apply_link"))
        and (
            len(normalize_text(job.get("description"))) < 80
            or normalize_text(job.get("salary")).lower() in {"", "not specified"}
        )
    ][:max_jobs]
    if not api_key or not candidates:
        return jobs

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(detail_fetcher, api_key, normalize_text(job.get("apply_link"))): job
            for job in candidates
        }
        for future in as_completed(future_map):
            job = future_map[future]
            try:
                details = future.result() or {}
            except Exception:
                details = {}

            if not isinstance(details, dict):
                continue

            description = normalize_text(details.get("description"))
            salary = normalize_text(details.get("salary"))
            location = normalize_text(details.get("location"))

            if description:
                job["description"] = description
            if salary:
                job["salary"] = salary
            if location:
                job["location"] = location

    return jobs
