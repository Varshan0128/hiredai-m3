import type { WorkMode, CompanyType, ExperienceLevel, MatchDecision, MatchExplanation, MatchResultPayload } from "@hiredai/types";

const WEIGHTS = { roleFit: 25, skillFit: 25, locationFit: 10, salaryFit: 10, workModeFit: 10, experienceFit: 10, companyTypeFit: 10 };

export interface UserPreferenceSnapshot {
  targetRoles: string[]; preferredLocations: string[];
  minSalary: number | null; maxSalary: number | null;
  workModes: WorkMode[]; companyTypes: CompanyType[];
  experienceLevels: ExperienceLevel[]; minimumMatchScore: number;
  fullyAutomatic: boolean; maxApplicationsPerDay: number;
  maxApplicationsPerWeek: number; postingDateFrom: Date | null; postingDateTo: Date | null;
}

export interface JobSnapshot {
  id: string; title: string; description: string;
  location: string | null; normalizedLocation: string | null;
  salaryMin: number | null; salaryMax: number | null;
  workMode: WorkMode | null; companyType: CompanyType | null;
  experienceLevel: ExperienceLevel | null; skills: string[];
  postedAt: Date | null; expiresAt: Date | null;
  isActive: boolean; applyUrl: string | null; sourceProvider: string;
}

export interface ScoringInput {
  preference: UserPreferenceSnapshot; job: JobSnapshot;
  resumeSkills: string[]; resumeRoleTag: string | null; resumeId: string | null;
  alreadyApplied: boolean; applicationsToday: number; applicationsThisWeek: number;
}

function hardFilter(input: ScoringInput): string | null {
  const { preference: p, job: j, alreadyApplied, applicationsToday, applicationsThisWeek } = input;
  if (!j.isActive) return "Job is inactive";
  if (j.expiresAt && new Date() > j.expiresAt) return "Job expired";
  if (alreadyApplied) return "Already applied";
  if (applicationsToday >= p.maxApplicationsPerDay) return `Daily limit reached (${p.maxApplicationsPerDay})`;
  if (applicationsThisWeek >= p.maxApplicationsPerWeek) return `Weekly limit reached (${p.maxApplicationsPerWeek})`;
  if (p.postingDateFrom && j.postedAt && j.postedAt < p.postingDateFrom) return "Posted before date range";
  if (p.postingDateTo && j.postedAt && j.postedAt > p.postingDateTo) return "Posted after date range";
  if (p.targetRoles.length > 0) {
    const tl = j.title.toLowerCase();
    const match = p.targetRoles.some((r) => tl.includes(r.toLowerCase()) || r.toLowerCase().split(" ").some((w) => tl.includes(w)));
    if (!match) return `Role mismatch: "${j.title}"`;
  }
  if (p.workModes.length > 0 && j.workMode && !p.workModes.includes(j.workMode)) return `Work mode mismatch: ${j.workMode}`;
  return null;
}

function scoreRole(targetRoles: string[], title: string, roleTag: string | null) {
  const tl = title.toLowerCase(); let best = 0;
  for (const r of targetRoles) {
    const rl = r.toLowerCase();
    if (tl === rl) { best = 100; break; }
    if (tl.includes(rl)) { best = Math.max(best, 90); continue; }
    const words = rl.split(/\s+/);
    best = Math.max(best, (words.filter((w) => tl.includes(w)).length / words.length) * 80);
  }
  if (roleTag && title.toLowerCase().includes(roleTag.toLowerCase())) best = Math.min(100, best + 10);
  return Math.round(best);
}

function scoreSkills(resumeSkills: string[], jobSkills: string[], desc: string) {
  const skills = jobSkills.length > 0 ? jobSkills : extractSkills(desc);
  if (skills.length === 0) return { score: 50, matched: [] as string[], missing: [] as string[] };
  const rs = new Set(resumeSkills.map((s) => s.toLowerCase()));
  const matched = skills.filter((s) => rs.has(s.toLowerCase()));
  const missing = skills.filter((s) => !rs.has(s.toLowerCase()));
  return { score: Math.round((matched.length / skills.length) * 100), matched, missing };
}

function scoreLocation(prefs: string[], loc: string | null) {
  if (prefs.length === 0) return { score: 80, reason: "No location preference" };
  if (!loc) return { score: 50, reason: "Location not specified" };
  const ll = loc.toLowerCase();
  for (const p of prefs) if (ll.includes(p.toLowerCase()) || p.toLowerCase().includes(ll)) return { score: 100, reason: `Matches "${p}"` };
  return { score: 20, reason: `"${loc}" doesn't match preferences` };
}

function scoreSalary(minP: number | null, maxP: number | null, jMin: number | null, jMax: number | null) {
  if (!minP && !maxP) return { score: 75, reason: "No salary preference" };
  if (!jMin && !jMax) return { score: 60, reason: "Salary not specified" };
  const mid = jMin && jMax ? (jMin + jMax) / 2 : jMin ?? jMax ?? 0;
  if (minP && mid < minP) return { score: 20, reason: `${mid} below minimum ${minP}` };
  return { score: 100, reason: "Salary within range" };
}

function scoreWorkMode(prefs: WorkMode[], mode: WorkMode | null) {
  if (prefs.length === 0) return { score: 80, reason: "No work mode preference" };
  if (!mode) return { score: 60, reason: "Work mode not specified" };
  return prefs.includes(mode) ? { score: 100, reason: `Matches ${mode}` } : { score: 20, reason: `${mode} not preferred` };
}

function scoreExperience(prefs: ExperienceLevel[], level: ExperienceLevel | null) {
  if (prefs.length === 0) return { score: 80, reason: "No exp preference" };
  if (!level) return { score: 65, reason: "Exp level not specified" };
  if (prefs.includes(level)) return { score: 100, reason: `Level ${level} matches` };
  const order: ExperienceLevel[] = ["entry", "junior", "mid", "senior", "lead", "executive"];
  const diff = Math.min(...prefs.map((p) => Math.abs(order.indexOf(p) - order.indexOf(level))));
  return diff === 1 ? { score: 60, reason: `Adjacent level (${level})` } : { score: 30, reason: `Level mismatch: ${level}` };
}

function scoreCompanyType(prefs: CompanyType[], type: CompanyType | null) {
  if (prefs.length === 0) return { score: 80, reason: "No company type preference" };
  if (!type || type === "unknown") return { score: 65, reason: "Company type unknown" };
  return prefs.includes(type) ? { score: 100, reason: `Type ${type} matches` } : { score: 40, reason: `Type ${type} not preferred` };
}

function extractSkills(text: string): string[] {
  const known = ["javascript","typescript","python","java","react","nodejs","nextjs","express","postgresql","mysql","mongodb","redis","aws","docker","kubernetes","graphql","tailwind","css","html","sql"];
  const lower = text.toLowerCase();
  return known.filter((s) => lower.includes(s));
}

export function scoreJob(input: ScoringInput): MatchResultPayload {
  const { preference: p, job: j, resumeSkills, resumeRoleTag, resumeId } = input;
  const filterReason = hardFilter(input);

  if (filterReason) {
    const exp: MatchExplanation = { roleFitScore:0,skillFitScore:0,locationFitScore:0,salaryFitScore:0,workModeFitScore:0,experienceFitScore:0,companyTypeFitScore:0,matchedSkills:[],missingSkills:[],locationReason:"",salaryReason:"",companyReason:"",workModeReason:"",decisionReason:filterReason };
    return { matchScore: 0, decision: "skip", explanation: exp, resumeId };
  }

  const role = scoreRole(p.targetRoles, j.title, resumeRoleTag);
  const skill = scoreSkills(resumeSkills, j.skills, j.description);
  const loc = scoreLocation(p.preferredLocations, j.normalizedLocation ?? j.location);
  const sal = scoreSalary(p.minSalary, p.maxSalary, j.salaryMin, j.salaryMax);
  const wm = scoreWorkMode(p.workModes, j.workMode);
  const exp = scoreExperience(p.experienceLevels, j.experienceLevel);
  const ct = scoreCompanyType(p.companyTypes, j.companyType);

  const matchScore = Math.round(
    (role * WEIGHTS.roleFit + skill.score * WEIGHTS.skillFit + loc.score * WEIGHTS.locationFit +
     sal.score * WEIGHTS.salaryFit + wm.score * WEIGHTS.workModeFit +
     exp.score * WEIGHTS.experienceFit + ct.score * WEIGHTS.companyTypeFit) / 100
  );

  const ambiguous = !j.workMode || !j.companyType || j.salaryMin === null || !j.applyUrl;
  let decision: MatchDecision;
  let decisionReason: string;

  if (matchScore < p.minimumMatchScore) {
    decision = "skip"; decisionReason = `Score ${matchScore} below threshold ${p.minimumMatchScore}`;
  } else if (!p.fullyAutomatic) {
    decision = "needs_review"; decisionReason = "Semi-automatic mode — user review required";
  } else if (ambiguous) {
    decision = "needs_review"; decisionReason = "Score qualifies but job data is incomplete";
  } else {
    decision = "auto_apply"; decisionReason = `Score ${matchScore} meets threshold with complete data`;
  }

  const explanation: MatchExplanation = {
    roleFitScore: role, skillFitScore: skill.score, locationFitScore: loc.score,
    salaryFitScore: sal.score, workModeFitScore: wm.score, experienceFitScore: exp.score,
    companyTypeFitScore: ct.score, matchedSkills: skill.matched, missingSkills: skill.missing,
    locationReason: loc.reason, salaryReason: sal.reason,
    companyReason: ct.reason, workModeReason: wm.reason, decisionReason,
  };

  return { matchScore, decision, explanation, resumeId };
}
