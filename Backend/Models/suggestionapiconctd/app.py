"""
Resume Grammar Checker API (Debug Version)
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Optional
import tempfile
import os
import logging
import uvicorn
import requests
import re
from pathlib import Path
from dotenv import load_dotenv

# Import grammar checker
from grammar_checker import (
    grammar_analysis,
    get_errors_by_category,
    get_error_count,
    has_errors,
    filter_by_category
)

from file_reader import read_resume_file
from api.resume_routes import router as resume_router
from core.settings import settings
from db.session import init_db
from services.resume_analysis_service import ResumeAnalysisService

logger = logging.getLogger("resume_runtime")

# Load the workspace-level .env (walk up from this file path).
for _parent in Path(__file__).resolve().parents:
    _env_file = _parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file, override=False)
        break


def _to_int(value: Optional[str], default: int) -> int:
    try:
        return int(value) if value is not None else default
    except ValueError:
        return default


PYTHON_PUBLIC_URL = (os.getenv("VITE_PYTHON_API_URL") or "http://localhost:8000").rstrip("/")
PYTHON_BIND_HOST = os.getenv("PYTHON_BIND_HOST", "0.0.0.0")
PYTHON_BIND_PORT = _to_int(os.getenv("PYTHON_PORT"), 8000)
FRONTEND_URL = os.getenv("VITE_FRONTEND_URL")
ALLOWED_ORIGINS = [
    origin for origin in [
        FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://${FRONTEND_HOST}:${FRONTEND_PORT}"
    ] if origin and "${" not in origin
]
SERPAPI_KEY = (os.getenv("SERPAPI_KEY") or "").strip()
SERPER_API_KEY = (os.getenv("SERPER_API_KEY") or "").strip()
SCRAPINGDOG_API_KEY = (os.getenv("SCRAPINGDOG_API_KEY") or "").strip()

ROLE_CATALOG: Dict[str, Dict[str, object]] = {
    "frontend": {
        "query": "Frontend Developer",
        "keywords": {
            "react", "next.js", "nextjs", "javascript", "typescript", "html",
            "css", "tailwind", "redux", "frontend", "ui", "ux", "web"
        },
        "jobs": [
            {"title": "Frontend Developer", "company": "Zoho", "location": "Chennai", "type": "On-site", "experience": "Entry Level", "salary": "$8k-$14k", "aiRisk": 26, "posted": "2 days ago", "requirements": ["React", "JavaScript", "CSS", "REST APIs"], "description": "Build and improve customer-facing web experiences with modern frontend tooling and strong UI polish."},
            {"title": "React Developer", "company": "Freshworks", "location": "Chennai", "type": "Hybrid", "experience": "Mid Level", "salary": "$10k-$18k", "aiRisk": 24, "posted": "1 day ago", "requirements": ["React", "TypeScript", "Redux", "Testing Library"], "description": "Own reusable React components, improve performance, and collaborate closely with product and design teams."},
            {"title": "UI Engineer", "company": "Razorpay", "location": "Bengaluru", "type": "Hybrid", "experience": "Mid Level", "salary": "$14k-$22k", "aiRisk": 28, "posted": "3 days ago", "requirements": ["TypeScript", "Design Systems", "Accessibility", "Storybook"], "description": "Translate product requirements into scalable interface systems with strong accessibility and maintainability."},
            {"title": "Web Application Engineer", "company": "Paytm", "location": "Noida", "type": "Remote", "experience": "Mid Level", "salary": "$12k-$20k", "aiRisk": 30, "posted": "4 days ago", "requirements": ["React", "HTML", "CSS", "API Integration"], "description": "Develop responsive web applications, integrate APIs, and ship polished features in fast-moving product cycles."},
            {"title": "Frontend Software Engineer", "company": "MakeMyTrip", "location": "Gurugram", "type": "Hybrid", "experience": "Senior", "salary": "$18k-$28k", "aiRisk": 27, "posted": "5 days ago", "requirements": ["React", "Performance Optimization", "TypeScript", "CI/CD"], "description": "Lead frontend feature delivery, improve runtime performance, and mentor developers on modern engineering practices."},
        ],
    },
    "backend": {
        "query": "Backend Developer",
        "keywords": {
            "java", "spring", "spring boot", "python", "node", "backend",
            "api", "microservices", "sql", "postgresql", "mysql", "django"
        },
        "jobs": [
            {"title": "Backend Developer", "company": "Infosys", "location": "Pune", "type": "Hybrid", "experience": "Entry Level", "salary": "$7k-$13k", "aiRisk": 32, "posted": "2 days ago", "requirements": ["Java", "Spring Boot", "SQL", "REST APIs"], "description": "Build backend services, integrate databases, and support stable production APIs for enterprise products."},
            {"title": "Java Spring Boot Engineer", "company": "TCS", "location": "Hyderabad", "type": "On-site", "experience": "Mid Level", "salary": "$10k-$16k", "aiRisk": 34, "posted": "1 day ago", "requirements": ["Java", "Spring Boot", "Microservices", "PostgreSQL"], "description": "Design and maintain Spring Boot microservices, improve observability, and support secure business workflows."},
            {"title": "API Developer", "company": "PhonePe", "location": "Bengaluru", "type": "Hybrid", "experience": "Mid Level", "salary": "$14k-$24k", "aiRisk": 31, "posted": "3 days ago", "requirements": ["REST APIs", "Python", "Databases", "Docker"], "description": "Create reliable APIs, optimize service performance, and collaborate with frontend teams on end-to-end delivery."},
            {"title": "Python Backend Engineer", "company": "CRED", "location": "Bengaluru", "type": "Remote", "experience": "Mid Level", "salary": "$16k-$26k", "aiRisk": 33, "posted": "4 days ago", "requirements": ["Python", "FastAPI", "SQL", "Cloud Deployment"], "description": "Build Python services for internal platforms, improve code quality, and own backend feature execution."},
            {"title": "Microservices Engineer", "company": "Tech Mahindra", "location": "Hyderabad", "type": "Hybrid", "experience": "Senior", "salary": "$18k-$30k", "aiRisk": 35, "posted": "6 days ago", "requirements": ["Java", "Spring", "Kafka", "Distributed Systems"], "description": "Develop resilient microservices, support event-driven systems, and improve service reliability at scale."},
        ],
    },
    "data": {
        "query": "Data Analyst",
        "keywords": {
            "data", "sql", "python", "excel", "power bi", "tableau",
            "analytics", "dashboard", "statistics", "reporting"
        },
        "jobs": [
            {"title": "Data Analyst", "company": "Tiger Analytics", "location": "Chennai", "type": "Hybrid", "experience": "Entry Level", "salary": "$8k-$15k", "aiRisk": 41, "posted": "2 days ago", "requirements": ["SQL", "Excel", "Dashboarding", "Reporting"], "description": "Analyze business data, create dashboards, and communicate insights that guide operational decisions."},
            {"title": "Business Analyst", "company": "Accenture", "location": "Bengaluru", "type": "Hybrid", "experience": "Mid Level", "salary": "$10k-$18k", "aiRisk": 37, "posted": "1 day ago", "requirements": ["Excel", "SQL", "Stakeholder Communication", "Documentation"], "description": "Work with business stakeholders to turn data findings into actionable product and process recommendations."},
            {"title": "BI Analyst", "company": "Deloitte", "location": "Hyderabad", "type": "On-site", "experience": "Mid Level", "salary": "$12k-$20k", "aiRisk": 39, "posted": "3 days ago", "requirements": ["Power BI", "SQL", "Data Modeling", "Visualization"], "description": "Own dashboard development, data validation, and recurring analytics for leadership and client teams."},
            {"title": "Product Analyst", "company": "Swiggy", "location": "Bengaluru", "type": "Remote", "experience": "Mid Level", "salary": "$14k-$24k", "aiRisk": 34, "posted": "4 days ago", "requirements": ["SQL", "Experimentation", "Metrics", "Python"], "description": "Partner with product teams to evaluate experiments, define metrics, and improve user-facing outcomes."},
            {"title": "Reporting Analyst", "company": "Wipro", "location": "Pune", "type": "Hybrid", "experience": "Entry Level", "salary": "$7k-$12k", "aiRisk": 43, "posted": "5 days ago", "requirements": ["Excel", "Reporting", "Data Cleaning", "SQL"], "description": "Prepare reports, validate data quality, and support recurring business reviews with clear analysis."},
        ],
    },
    "design": {
        "query": "UI UX Designer",
        "keywords": {
            "figma", "ui", "ux", "wireframe", "prototype", "design",
            "research", "usability", "visual", "interaction"
        },
        "jobs": [
            {"title": "UI/UX Designer", "company": "Myntra", "location": "Bengaluru", "type": "Hybrid", "experience": "Entry Level", "salary": "$9k-$16k", "aiRisk": 21, "posted": "2 days ago", "requirements": ["Figma", "Wireframing", "Prototyping", "Design Systems"], "description": "Design intuitive digital experiences and collaborate with developers to ship polished interfaces."},
            {"title": "Product Designer", "company": "Meesho", "location": "Bengaluru", "type": "Remote", "experience": "Mid Level", "salary": "$14k-$24k", "aiRisk": 19, "posted": "1 day ago", "requirements": ["Figma", "User Flows", "Prototyping", "Research"], "description": "Own end-to-end product design work from discovery to delivery across growth and core product teams."},
            {"title": "UX Researcher", "company": "NielsenIQ", "location": "Mumbai", "type": "Hybrid", "experience": "Mid Level", "salary": "$12k-$20k", "aiRisk": 18, "posted": "3 days ago", "requirements": ["Research", "Interviews", "Usability Testing", "Synthesis"], "description": "Plan user studies, synthesize findings, and influence product direction with evidence-based insights."},
            {"title": "Visual Designer", "company": "Zeta", "location": "Hyderabad", "type": "On-site", "experience": "Mid Level", "salary": "$10k-$18k", "aiRisk": 23, "posted": "4 days ago", "requirements": ["Visual Design", "Figma", "Brand Consistency", "Typography"], "description": "Create high-quality interface visuals and ensure consistency across marketing and product experiences."},
            {"title": "Design Systems Specialist", "company": "Flipkart", "location": "Bengaluru", "type": "Hybrid", "experience": "Senior", "salary": "$18k-$28k", "aiRisk": 20, "posted": "6 days ago", "requirements": ["Design Systems", "Tokens", "Figma", "Documentation"], "description": "Scale component systems, improve design handoff, and strengthen consistency across multiple products."},
        ],
    },
    "project": {
        "query": "Project Coordinator",
        "keywords": {
            "project", "project manager", "project management", "project coordinator",
            "program coordinator", "coordination", "stakeholder", "timeline",
            "planning", "leadership", "communication", "operations"
        },
        "jobs": [
            {"title": "Project Coordinator", "company": "Infosys BPM", "location": "Pune", "type": "Hybrid", "experience": "Entry Level", "salary": "$7k-$12k", "aiRisk": 25, "posted": "1 day ago", "requirements": ["Project Coordination", "Communication", "Scheduling", "Stakeholder Management"], "description": "Coordinate schedules, track project actions, and keep stakeholders aligned across delivery milestones."},
            {"title": "Project Management Trainee", "company": "Cognizant", "location": "Chennai", "type": "On-site", "experience": "Entry Level", "salary": "$8k-$14k", "aiRisk": 29, "posted": "2 days ago", "requirements": ["Project Management", "Leadership", "Documentation", "Presentation"], "description": "Support project planning, document follow-ups, and drive meeting readiness for delivery teams."},
            {"title": "Program Coordinator", "company": "Accenture", "location": "Bengaluru", "type": "Hybrid", "experience": "Entry Level", "salary": "$9k-$15k", "aiRisk": 27, "posted": "3 days ago", "requirements": ["Coordination", "Communication", "Reporting", "Team Collaboration"], "description": "Help manage program cadences, reporting, and team coordination across multiple workstreams."},
            {"title": "PMO Analyst", "company": "Capgemini", "location": "Hyderabad", "type": "Hybrid", "experience": "Entry Level", "salary": "$10k-$16k", "aiRisk": 31, "posted": "4 days ago", "requirements": ["Documentation", "Reporting", "Stakeholder Coordination", "Excel"], "description": "Maintain project reporting, track progress, and support PMO governance processes."},
            {"title": "Operations Coordinator", "company": "HCLTech", "location": "Noida", "type": "On-site", "experience": "Entry Level", "salary": "$8k-$13k", "aiRisk": 30, "posted": "5 days ago", "requirements": ["Operations", "Coordination", "Communication", "Problem Solving"], "description": "Coordinate day-to-day operations, handle stakeholder communication, and support structured follow-through."},
        ],
    },
    "marketing": {
        "query": "Digital Marketing Specialist",
        "keywords": {
            "seo", "sem", "marketing", "campaign", "content", "analytics",
            "social media", "branding", "crm", "growth"
        },
        "jobs": [
            {"title": "Digital Marketing Specialist", "company": "UpGrad", "location": "Mumbai", "type": "Hybrid", "experience": "Entry Level", "salary": "$7k-$13k", "aiRisk": 38, "posted": "2 days ago", "requirements": ["SEO", "Campaign Analysis", "Content Strategy", "Analytics"], "description": "Plan and optimize digital campaigns, monitor performance, and improve lead generation across channels."},
            {"title": "Content Marketing Executive", "company": "Byju's", "location": "Bengaluru", "type": "Remote", "experience": "Entry Level", "salary": "$6k-$11k", "aiRisk": 44, "posted": "1 day ago", "requirements": ["Content Writing", "SEO", "Editorial Planning", "Analytics"], "description": "Create and optimize educational content strategies that support traffic growth and engagement."},
            {"title": "Growth Marketing Analyst", "company": "Dream11", "location": "Mumbai", "type": "Hybrid", "experience": "Mid Level", "salary": "$12k-$20k", "aiRisk": 35, "posted": "3 days ago", "requirements": ["Analytics", "Campaigns", "A/B Testing", "CRM"], "description": "Use data to improve acquisition funnels, campaign efficiency, and lifecycle marketing performance."},
            {"title": "SEO Analyst", "company": "Webenza", "location": "Bengaluru", "type": "On-site", "experience": "Mid Level", "salary": "$8k-$14k", "aiRisk": 46, "posted": "4 days ago", "requirements": ["SEO", "Keyword Research", "Google Analytics", "Technical Audits"], "description": "Drive search visibility improvements through audits, optimization plans, and content collaboration."},
            {"title": "Brand Marketing Associate", "company": "Nykaa", "location": "Mumbai", "type": "Hybrid", "experience": "Mid Level", "salary": "$10k-$18k", "aiRisk": 29, "posted": "5 days ago", "requirements": ["Brand Strategy", "Campaigns", "Coordination", "Reporting"], "description": "Support brand campaigns, cross-functional launches, and performance reviews across marketing initiatives."},
        ],
    },
    "business": {
        "query": "Operations Analyst",
        "keywords": {
            "operations", "management", "business", "coordination", "project",
            "stakeholder", "customer", "process", "planning", "documentation"
        },
        "jobs": [
            {"title": "Operations Analyst", "company": "Amazon", "location": "Hyderabad", "type": "On-site", "experience": "Entry Level", "salary": "$8k-$14k", "aiRisk": 28, "posted": "2 days ago", "requirements": ["Reporting", "Excel", "Process Improvement", "Communication"], "description": "Monitor operational KPIs, improve reporting flows, and support day-to-day execution teams."},
            {"title": "Program Coordinator", "company": "Infosys BPM", "location": "Pune", "type": "Hybrid", "experience": "Entry Level", "salary": "$7k-$12k", "aiRisk": 25, "posted": "1 day ago", "requirements": ["Coordination", "Documentation", "Scheduling", "Stakeholder Management"], "description": "Support program delivery through structured planning, cross-team follow-up, and progress reporting."},
            {"title": "Project Analyst", "company": "Capgemini", "location": "Bengaluru", "type": "Hybrid", "experience": "Mid Level", "salary": "$10k-$18k", "aiRisk": 27, "posted": "3 days ago", "requirements": ["Project Tracking", "Excel", "Communication", "Risk Logs"], "description": "Maintain project artifacts, track action items, and help teams stay aligned on timelines and dependencies."},
            {"title": "Customer Success Associate", "company": "Chargebee", "location": "Chennai", "type": "Remote", "experience": "Mid Level", "salary": "$9k-$16k", "aiRisk": 23, "posted": "4 days ago", "requirements": ["Client Communication", "Problem Solving", "CRM", "Reporting"], "description": "Manage customer relationships, resolve issues, and help clients achieve value from the product."},
            {"title": "Business Operations Executive", "company": "HCLTech", "location": "Noida", "type": "On-site", "experience": "Mid Level", "salary": "$9k-$15k", "aiRisk": 30, "posted": "6 days ago", "requirements": ["Operations", "Reporting", "Stakeholder Management", "Documentation"], "description": "Support business operations with structured analysis, cross-team coordination, and process follow-through."},
        ],
    },
}

COMMON_TECH_SKILLS = {
    "python", "java", "spring boot", "spring", "react", "node.js", "node",
    "javascript", "typescript", "sql", "mysql", "postgresql", "mongodb",
    "html", "css", "tailwind", "docker", "kubernetes", "aws", "azure",
    "power bi", "tableau", "excel", "figma", "seo", "analytics", "fastapi"
}

resume_analysis_service = ResumeAnalysisService()


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _extract_resume_skills(text: str, limit: int = 8) -> List[str]:
    analysis = resume_analysis_service.analyze(text)
    return [skill["name"] for skill in analysis.get("explicit_skills", [])[:limit]]


def _infer_job_family(skills: List[str], text: str, filename: str = "") -> str:
    analysis = resume_analysis_service.analyze(" ".join(part for part in [text, filename] if part))
    top_role = next(iter(analysis.get("recommended_roles", [])), {}).get("title", "").lower()
    if any(term in top_role for term in ("project", "program", "pmo")):
        return "project"
    if any(term in top_role for term in ("operations", "business operations")):
        return "business"

    evidence = " ".join([filename, text, " ".join(skills)]).lower()
    best_family = "backend"
    best_score = 0

    for family, config in ROLE_CATALOG.items():
        keywords = config["keywords"]
        score = 0
        for keyword in keywords:
            score += evidence.count(keyword)
        if score > best_score:
            best_score = score
            best_family = family

    return best_family


def _keywords_from_signal(skills: List[str], text: str, filename: str = "") -> str:
    analysis = resume_analysis_service.analyze(" ".join(part for part in [text, filename] if part))
    top_role = next(iter(analysis.get("recommended_roles", [])), {}).get("title")
    explicit_skills = [skill["name"] for skill in analysis.get("explicit_skills", [])]
    if top_role:
        if explicit_skills:
            return f"{top_role} {' '.join(explicit_skills[:3])}".strip()
        return top_role
    family = _infer_job_family(skills, text, filename)
    role_query = str(ROLE_CATALOG[family]["query"])
    if skills:
        return f"{role_query} {' '.join(skills[:3])}".strip()
    return role_query


def _make_job_id(title: str, company: str, location: str) -> str:
    seed = f"{title}-{company}-{location}".lower()
    return re.sub(r"[^a-z0-9]+", "-", seed).strip("-")


def _extract_apply_link(job: Dict[str, object]) -> str:
    link = None

    apply_options = job.get("apply_options")
    if isinstance(apply_options, list) and apply_options:
        first = apply_options[0]
        if isinstance(first, dict):
            link = first.get("link")

    if not link:
        link = job.get("share_link")

    if not link:
        link = job.get("apply_link") or job.get("link") or job.get("url") or job.get("redirect_url")

    return str(link or "").strip()


def _normalize_external_jobs(
    jobs: List[Dict[str, object]],
    family: str,
    skills: List[str],
    location: str,
    limit: int = 10,
) -> List[Dict[str, object]]:
    templates = list(ROLE_CATALOG[family]["jobs"])
    normalized: List[Dict[str, object]] = []
    seen_ids = set()

    for index, job in enumerate(jobs[:limit]):
        template = templates[index % len(templates)]
        title = _normalize_text(str(job.get("title") or "Untitled role"))
        company = _normalize_text(str(job.get("company") or "Unknown company"))
        job_location = _normalize_text(str(job.get("location") or location or "Location not specified"))
        description = _normalize_text(str(job.get("description") or "No description available."))
        job_id = _make_job_id(title, company, job_location)
        if job_id in seen_ids:
            job_id = f"{job_id}-{index + 1}"
        seen_ids.add(job_id)

        requirements = job.get("requirements")
        if not isinstance(requirements, list):
            requirements = skills[:6]

        normalized.append({
            "id": job_id,
            "title": title,
            "company": company,
            "location": job_location,
            "link": _extract_apply_link(job),
            "source": job.get("source") or "unknown",
            "type": job.get("type") or "Remote",
            "salary": job.get("salary") or "Not specified",
            "experience": job.get("experience") or "Not specified",
            "posted": job.get("posted") or "Recently",
            "description": description,
            "requirements": requirements,
            "aiRisk": job.get("aiRisk") or template["aiRisk"],
        })

    return normalized


def _fetch_serpapi_jobs(role: str, location: str, limit: int = 10) -> List[Dict[str, object]]:
    if not SERPAPI_KEY:
        print("SerpAPI key missing")
        return []

    try:
        response = requests.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google_jobs",
                "q": f"{role} jobs",
                "location": location,
                "api_key": SERPAPI_KEY,
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        jobs: List[Dict[str, object]] = []
        for job in data.get("jobs_results", [])[:limit]:
            jobs.append({
                "title": job.get("title"),
                "company": job.get("company_name"),
                "location": job.get("location") or location,
                "description": job.get("description"),
                "link": _extract_apply_link(job),
                "source": "serpapi",
            })
        return jobs
    except (requests.RequestException, ValueError) as exc:
        print(f"SerpAPI failed: {exc}")
        return []


def _fetch_serper_jobs(role: str, location: str, limit: int = 10) -> List[Dict[str, object]]:
    if not SERPER_API_KEY:
        print("Serper key missing")
        return []

    try:
        response = requests.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json",
            },
            json={"q": f"{role} jobs in {location}"},
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        jobs: List[Dict[str, object]] = []
        for item in data.get("organic", [])[:limit]:
            jobs.append({
                "title": item.get("title"),
                "company": item.get("source"),
                "location": location,
                "description": item.get("snippet"),
                "link": item.get("link"),
                "source": "serper",
            })
        return jobs
    except (requests.RequestException, ValueError) as exc:
        print(f"Serper failed: {exc}")
        return []


def _fetch_scrapingdog_jobs(role: str, location: str, limit: int = 10) -> List[Dict[str, object]]:
    if not SCRAPINGDOG_API_KEY:
        print("ScrapingDog key missing")
        return []

    try:
        response = requests.get(
            "https://api.scrapingdog.com/google",
            params={
                "api_key": SCRAPINGDOG_API_KEY,
                "query": f"{role} jobs in {location}",
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("results") or data.get("organic_results") or []
        jobs: List[Dict[str, object]] = []
        for item in results[:limit]:
            jobs.append({
                "title": item.get("title"),
                "company": item.get("domain"),
                "location": location,
                "description": item.get("snippet"),
                "link": item.get("link"),
                "source": "scrapingdog",
            })
        return jobs
    except (requests.RequestException, ValueError) as exc:
        print(f"ScrapingDog failed: {exc}")
        return []


def _get_jobs_with_fallback(role: str, location: str, skills: List[str], filename: str = "") -> List[Dict[str, object]]:
    family = _infer_job_family(skills, role, filename)

    jobs = _fetch_serpapi_jobs(role, location)
    if jobs:
        print("Using SerpAPI")
        return _normalize_external_jobs(jobs, family, skills, location)

    print("Primary failed -> switching to secondary")
    jobs = _fetch_serper_jobs(role, location)
    if jobs:
        print("Using Serper")
        return _normalize_external_jobs(jobs, family, skills, location)

    print("Secondary failed -> switching to backup")
    jobs = _fetch_scrapingdog_jobs(role, location)
    if jobs:
        print("Using ScrapingDog")
        return _normalize_external_jobs(jobs, family, skills, location)

    return []


# =============================================================================
# FASTAPI CONFIG
# =============================================================================

app = FastAPI(
    title="Resume Grammar Checker",
    version="2.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.resume_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.resume_upload_dir.parent), name="uploads")
app.include_router(resume_router)


# =============================================================================
# MODELS
# =============================================================================

class TextAnalysisRequest(BaseModel):
    text: str


class JobDiscoveryRequest(BaseModel):
    skills: List[str] = []
    location: str = "India"


class GrammarIssue(BaseModel):
    error: str
    suggestion: str
    reason: str
    category: str
    rule_id: str
    offset: int
    context: str


class AnalysisResponse(BaseModel):
    success: bool
    total_issues: int
    has_errors: bool
    category_summary: Dict[str, int]
    issues: List[GrammarIssue]
    message: Optional[str] = None


# =============================================================================
# JOB DISCOVERY ENDPOINT
# =============================================================================

def _build_jobs_response(skills: List[str], location: str) -> Dict[str, object]:
    skills = [skill.strip() for skill in skills if isinstance(skill, str) and skill.strip()]
    query = _keywords_from_signal(skills, " ".join(skills))
    location = location or "India"
    jobs = _get_jobs_with_fallback(query, location, skills)
    source = jobs[0].get("source") if jobs else "none"
    return {"jobs": jobs, "source": source, "count": len(jobs)}


@app.get("/jobs")
async def get_jobs(role: str = "Software Developer", location: str = "India"):
    skills = [part.strip() for part in re.split(r"[,/]| and ", role) if part.strip()]
    if not skills:
        skills = [role]
    return _build_jobs_response(skills, location)


@app.post("/jobs")
async def get_jobs_post(request: JobDiscoveryRequest):
    return _build_jobs_response(request.skills, request.location)


@app.post("/jobs-from-resume")
async def get_jobs_from_resume(file: UploadFile = File(...)):
    temp_file = None
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        if not file.filename.lower().endswith((".pdf", ".docx", ".txt")):
            raise HTTPException(status_code=400, detail="Unsupported format")

        content = await file.read()
        suffix = Path(file.filename).suffix or ".txt"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(content)
            temp_file = temp.name

        resume_text = read_resume_file(temp_file)
        analysis = resume_analysis_service.analyze(resume_text)
        skills = [skill["name"] for skill in analysis.get("explicit_skills", [])]
        keywords = _keywords_from_signal(skills, resume_text, file.filename or "")
        family = _infer_job_family(skills, resume_text, file.filename or "")

        jobs = _get_jobs_with_fallback(keywords, "India", skills, file.filename or "")
        logger.info(
            "jobs_from_resume filename=%s family=%s explicit=%s inferred=%s roles=%s jobs=%s",
            file.filename,
            family,
            [item["name"] for item in analysis.get("explicit_skills", [])],
            [item["name"] for item in analysis.get("inferred_skills", [])],
            [item["title"] for item in analysis.get("recommended_roles", [])],
            [job.get("title") for job in jobs[:5]],
        )

        return {
            "jobs": jobs,
            "selectedDomain": family,
            "skills": skills,
            "explicit_skills": analysis.get("explicit_skills", []),
            "inferred_skills": analysis.get("inferred_skills", []),
            "recommended_roles": analysis.get("recommended_roles", []),
            "similar_job_matches": analysis.get("similar_job_matches", []),
            "analyzer_version": analysis.get("analyzer_version", "live-pipeline-v2"),
            "query": keywords,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)


# =============================================================================
# SIMPLE FRONTEND
# =============================================================================

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    return """
    <html>
    <head><title>Grammar Checker</title></head>
    <body>
        <h2>Resume Grammar Checker</h2>
        <textarea id="text" rows="10" cols="80"></textarea><br><br>
        <button onclick="check()">Check Grammar</button>
        <pre id="output"></pre>

        <script>
        async function check() {
            const text = document.getElementById("text").value;

            const res = await fetch("/api/analyze/text", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({text})
            });

            const data = await res.json();
            document.getElementById("output").innerText =
                JSON.stringify(data, null, 2);
        }
        </script>
    </body>
    </html>
    """


@app.get("/docs", include_in_schema=False)
async def docs_redirect():
    return RedirectResponse(url="/api/docs")


# =============================================================================
# TEXT ANALYSIS ENDPOINT (DEBUG ENABLED)
# =============================================================================

@app.post("/api/analyze/text", response_model=AnalysisResponse)
async def analyze_text(request: TextAnalysisRequest):

    try:
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        print("\n================ DEBUG START ================")
        print("[DEBUG] RECEIVED TEXT:")
        print(request.text)
        print("=============================================")

        issues = grammar_analysis(request.text)

        print("[DEBUG] ISSUES FOUND:")
        print(issues)
        print("=============================================\n")

        return AnalysisResponse(
            success=True,
            total_issues=get_error_count(issues),
            has_errors=has_errors(issues),
            category_summary=get_errors_by_category(issues),
            issues=issues,
            message="Analysis completed successfully"
        )

    except Exception as e:
        print("[ERROR]", str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# FILE ANALYSIS ENDPOINT (DEBUG ENABLED)
# =============================================================================

@app.post("/api/analyze/file", response_model=AnalysisResponse)
async def analyze_file(file: UploadFile = File(...)):

    temp_file = None

    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        if not file.filename.lower().endswith(('.txt', '.pdf', '.docx')):
            raise HTTPException(status_code=400, detail="Unsupported format")

        content = await file.read()

        with tempfile.NamedTemporaryFile(delete=False) as temp:
            temp.write(content)
            temp_file = temp.name

        resume_text = read_resume_file(temp_file)

        print("\n================ FILE DEBUG START ================")
        print("[DEBUG] EXTRACTED TEXT (first 500 chars):")
        print(resume_text[:500])
        print("==================================================")

        issues = grammar_analysis(resume_text)

        print("[DEBUG] ISSUES FOUND:")
        print(issues)
        print("==================================================\n")

        return AnalysisResponse(
            success=True,
            total_issues=get_error_count(issues),
            has_errors=has_errors(issues),
            category_summary=get_errors_by_category(issues),
            issues=issues,
            message="File analysis completed"
        )

    except Exception as e:
        print("[FILE ERROR]", str(e))
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if temp_file and os.path.exists(temp_file):
            os.unlink(temp_file)


# =============================================================================
# STARTUP
# =============================================================================

@app.on_event("startup")
async def startup_event():
    init_db()
    print("\n======================================")
    print("Grammar Checker API Starting")
    print(f"URL: {PYTHON_PUBLIC_URL}")
    print("======================================\n")


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    uvicorn.run(app, host=PYTHON_BIND_HOST, port=PYTHON_BIND_PORT)
