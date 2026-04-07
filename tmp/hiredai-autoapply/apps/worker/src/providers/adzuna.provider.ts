import axios from "axios";
import type { NormalizedJob, JobSearchFilters, SourceProvider } from "@hiredai/types";

function normalizeLocation(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
function inferWorkMode(text: string) {
  const l = text.toLowerCase();
  if (/\bremote\b/.test(l)) return "remote" as const;
  if (/\bhybrid\b/.test(l)) return "hybrid" as const;
  if (/\bonsite\b|on-?site/.test(l)) return "onsite" as const;
  return null;
}
function inferExpLevel(text: string) {
  const l = text.toLowerCase();
  if (/entry.level|fresher|0.?1.?year/.test(l)) return "entry" as const;
  if (/junior|1.?3.?year/.test(l)) return "junior" as const;
  if (/mid.level|3.?5.?year/.test(l)) return "mid" as const;
  if (/senior|5.?8.?year|sr\./.test(l)) return "senior" as const;
  if (/lead|principal|8.?12.?year/.test(l)) return "lead" as const;
  return null;
}
function extractSkills(text: string): string[] {
  const known = ["javascript","typescript","python","java","react","nodejs","nextjs","express","postgresql","mysql","mongodb","redis","aws","docker","kubernetes","graphql","tailwind","css","html","sql"];
  const lower = text.toLowerCase();
  return known.filter((s) => lower.includes(s));
}
function buildDedupeKey(title: string, company: string, location: string | null): string {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 30);
  return `${n(title)}__${n(company)}__${n(location ?? "any")}`;
}

export class AdzunaProvider {
  constructor(
    private readonly appId: string,
    private readonly appKey: string,
    private readonly baseUrl = "https://api.adzuna.com/v1/api",
    private readonly country = "gb",
  ) {}

  getSourceName(): SourceProvider { return "adzuna"; }

  async searchJobs(filters: JobSearchFilters): Promise<NormalizedJob[]> {
    const params: Record<string, string | number> = {
      app_id: this.appId, app_key: this.appKey,
      results_per_page: filters.resultsPerPage ?? 20,
      page: filters.page ?? 1, what: filters.query,
    };
    if (filters.location) params.where = filters.location;
    if (filters.salaryMin) params.salary_min = filters.salaryMin;

    const url = `${this.baseUrl}/jobs/${this.country}/search/${params.page}`;
    const response = await axios.get(url, { params });
    return (response.data.results ?? []).map((r: any) => this.normalizeJob(r));
  }

  async fetchJobDetails(_id: string): Promise<NormalizedJob | null> { return null; }

  normalizeJob(raw: any): NormalizedJob {
    const text = `${raw.title ?? ""} ${raw.description ?? ""}`;
    const loc = raw.location?.display_name ?? null;
    return {
      externalId: String(raw.id),
      sourceProvider: "adzuna",
      title: raw.title ?? "Untitled",
      companyName: raw.company?.display_name ?? "Unknown",
      location: loc, normalizedLocation: normalizeLocation(loc),
      description: raw.description ?? "",
      salaryMin: raw.salary_min ?? null, salaryMax: raw.salary_max ?? null, currency: "GBP",
      applyUrl: raw.redirect_url ?? null, providerJobUrl: raw.redirect_url ?? null,
      postedAt: raw.created ? new Date(raw.created) : null, expiresAt: null,
      workMode: inferWorkMode(text), companyType: null,
      experienceLevel: inferExpLevel(text), skills: extractSkills(text),
      rawPayload: raw,
      dedupeKey: buildDedupeKey(raw.title ?? "", raw.company?.display_name ?? "", loc),
    };
  }

  extractApplyUrl(raw: any): string | null { return raw.redirect_url ?? null; }
}
