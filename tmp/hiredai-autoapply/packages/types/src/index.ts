export type SourceProvider = "adzuna" | "jooble";
export type WorkMode = "remote" | "hybrid" | "onsite";
export type CompanyType = "mnc" | "startup" | "product_based" | "service_based" | "unknown";
export type ExperienceLevel = "entry" | "junior" | "mid" | "senior" | "lead" | "executive";
export type MatchDecision = "auto_apply" | "needs_review" | "skip";
export type ApplicationStatus =
  | "discovered" | "matched" | "skipped" | "needs_review" | "approved"
  | "rejected" | "scheduled" | "submitting" | "submitted" | "failed" | "retrying" | "cancelled";
export type SubmissionMode = "direct_source_apply" | "mocked_structured_submit";

export interface NormalizedJob {
  externalId: string; sourceProvider: SourceProvider;
  title: string; companyName: string;
  location: string | null; normalizedLocation: string | null;
  description: string; salaryMin: number | null; salaryMax: number | null; currency: string | null;
  applyUrl: string | null; providerJobUrl: string | null;
  postedAt: Date | null; expiresAt: Date | null;
  workMode: WorkMode | null; companyType: CompanyType | null;
  experienceLevel: ExperienceLevel | null; skills: string[];
  rawPayload: Record<string, unknown>; dedupeKey: string | null;
}

export interface MatchExplanation {
  roleFitScore: number; skillFitScore: number; locationFitScore: number;
  salaryFitScore: number; workModeFitScore: number; experienceFitScore: number; companyTypeFitScore: number;
  matchedSkills: string[]; missingSkills: string[];
  locationReason: string; salaryReason: string; companyReason: string;
  workModeReason: string; decisionReason: string;
}

export interface MatchResultPayload {
  matchScore: number; decision: MatchDecision;
  explanation: MatchExplanation; resumeId: string | null;
}

export interface JobSearchFilters {
  query: string; location?: string; salaryMin?: number; salaryMax?: number;
  workMode?: WorkMode; page?: number; resultsPerPage?: number; datePosted?: string;
}

export interface PaginatedResponse<T> {
  data: T[]; total: number; page: number; limit: number; hasMore: boolean;
}
