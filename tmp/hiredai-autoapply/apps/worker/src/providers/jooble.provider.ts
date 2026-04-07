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
  return null;
}
function inferExpLevel(text: string) {
  const l = text.toLowerCase();
  if (/entry.level|fresher/.test(l)) return "entry" as const;
  if (/junior/.test(l)) return "junior" as const;
  if (/mid.level/.test(l)) return "mid" as const;
  if (/senior|sr\./.test(l)) return "senior" as const;
  return null;
}
function extractSkills(text: string): string[] {
  const known = ["javascript","typescript","python","java","react","nodejs","nextjs","express","postgresql","mysql","mongodb","redis","aws","docker","kubernetes","graphql","tailwind","css","html","sql"];
  return known.filter((s) => text.toLowerCase().includes(s));
}
function buildDedupeKey(title: string, company: string, location: string | null): string {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 30);
  return `${n(title)}__${n(company)}__${n(location ?? "any")}`;
}
function parseSalary(raw: string | null | undefined) {
  if (!raw) return { min: null, max: null, currency: "USD" };
  const str = String(raw).replace(/,/g, "");
  const nums = (str.match(/[\d.]+/g) ?? []).map(Number).filter((n) => n > 0);
  if (nums.length === 0) return { min: null, max: null, currency: "USD" };
  return { min: Math.min(...nums), max: nums.length > 1 ? Math.max(...nums) : null, currency: "USD" };
}

export class JoobleProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://jooble.org/api",
  ) {}

  getSourceName(): SourceProvider { return "jooble"; }

  async searchJobs(filters: JobSearchFilters): Promise<NormalizedJob[]> {
    const url = `${this.baseUrl}/${this.apiKey}`;
    const payload: Record<string, unknown> = { keywords: filters.query, page: filters.page ?? 1 };
    if (filters.location) payload.location = filters.location;
    const response = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
    return (response.data.jobs ?? []).map((j: any) => this.normalizeJob(j));
  }

  async fetchJobDetails(_id: string): Promise<NormalizedJob | null> { return null; }

  normalizeJob(raw: any): NormalizedJob {
    const text = `${raw.title ?? ""} ${raw.snippet ?? ""}`;
    const loc = raw.location ?? null;
    const salary = parseSalary(raw.salary);
    const id = raw.id ?? String(Math.abs(hashStr(`${raw.title}${raw.company}${raw.location}`)));
    return {
      externalId: String(id),
      sourceProvider: "jooble",
      title: raw.title ?? "Untitled",
      companyName: raw.company ?? "Unknown",
      location: loc, normalizedLocation: normalizeLocation(loc),
      description: raw.snippet ?? "",
      salaryMin: salary.min, salaryMax: salary.max, currency: salary.currency,
      applyUrl: raw.link ?? null, providerJobUrl: raw.link ?? null,
      postedAt: raw.updated ? new Date(raw.updated) : null, expiresAt: null,
      workMode: inferWorkMode(text), companyType: null,
      experienceLevel: inferExpLevel(text), skills: extractSkills(text),
      rawPayload: raw,
      dedupeKey: buildDedupeKey(raw.title ?? "", raw.company ?? "", loc),
    };
  }

  extractApplyUrl(raw: any): string | null { return raw.link ?? null; }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}
