import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const PROCESSING_STEPS = [
  "Uploading resume...",
  "Extracting skills...",
  "Analyzing job role...",
  "Calculating demand...",
  "Matching similar jobs...",
  "Finalizing insights...",
];

const TOTAL_DURATION_MS = 6000;
const STEP_DURATION_MS = 1000;
const JOB_DISCOVERY_ROUTE = "/jobs";

const HOT_SKILLS = {
  software: ["React", "TypeScript", "Node.js", "AWS", "Docker"],
  data: ["Python", "SQL", "Machine Learning", "Power BI", "Statistics"],
  design: ["Figma", "Design Systems", "UX Research", "Wireframing", "Prototyping"],
  marketing: ["SEO", "Content Strategy", "Analytics", "Campaigns", "CRM"],
  business: ["Stakeholder Management", "Excel", "Strategy", "Operations", "Communication"],
};

const JOB_CORPUS = [
  { title: "Frontend Developer", type: "Remote", location: "India", domain: "software", requiredSkills: ["React", "JavaScript", "TypeScript", "CSS", "Git"], reason: "Strong alignment with modern web product teams.", aiRisk: 27 },
  { title: "Full Stack Developer", type: "Hybrid", location: "Bengaluru", domain: "software", requiredSkills: ["React", "Node.js", "APIs", "SQL", "Docker"], reason: "Balanced frontend and backend ownership fits your profile.", aiRisk: 33 },
  { title: "Data Analyst", type: "Hybrid", location: "Hyderabad", domain: "data", requiredSkills: ["Python", "SQL", "Excel", "Power BI", "Statistics"], reason: "Analytical and reporting strengths transfer well here.", aiRisk: 35 },
  { title: "Product Analyst", type: "Remote", location: "Pune", domain: "data", requiredSkills: ["SQL", "Excel", "Dashboarding", "Experimentation", "Communication"], reason: "Good fit for turning user data into product insights.", aiRisk: 31 },
  { title: "UI/UX Designer", type: "Remote", location: "Chennai", domain: "design", requiredSkills: ["Figma", "UX Research", "Wireframing", "Prototyping", "Design Systems"], reason: "Creative problem solving and user empathy are valuable here.", aiRisk: 24 },
  { title: "Product Designer", type: "Hybrid", location: "Mumbai", domain: "design", requiredSkills: ["Figma", "Prototyping", "Design Systems", "Usability Testing", "Visual Design"], reason: "This path rewards creativity and cross-functional collaboration.", aiRisk: 22 },
  { title: "Digital Marketing Specialist", type: "Remote", location: "Delhi", domain: "marketing", requiredSkills: ["SEO", "Analytics", "Content Strategy", "Campaigns", "CRM"], reason: "Growth-focused roles benefit from communication and experimentation.", aiRisk: 39 },
  { title: "Operations Analyst", type: "On-site", location: "Gurugram", domain: "business", requiredSkills: ["Excel", "Operations", "Reporting", "Communication", "Problem Solving"], reason: "Structured execution and coordination are central here.", aiRisk: 29 },
];

type ParsedResume = {
  name: string;
  experienceYears: number;
  topSkills: string[];
  education: string;
  domain: string;
  gapAreas: string[];
  resumeText: string;
};

type StoredJobRecord = {
  id?: string;
  title?: string;
  company?: string;
  location?: string;
  type?: string;
  salary?: string;
  experience?: string;
  posted?: string;
  description?: string;
  requirements?: string[];
  aiRisk?: number;
};

type MatchedJob = {
  title: string;
  matchPct: number;
  reason: string;
  type: string;
  location: string;
  aiRisk: number;
  company?: string;
  salary?: string;
  posted?: string;
};

type DemandResult = {
  demandScore: number;
  demandLabel: string;
  hotSkills: string[];
  marketInsight: string;
};

type RiskResult = {
  riskPct: number;
  riskLabel: string;
  verdict: string;
};

type CareerScoreResult = {
  score: number;
  verdict: string;
  skillMatch: number;
};

type FuturePoint = {
  year: number;
  riskPct: number;
  label: string;
};

type SafeRole = {
  title: string;
  fit: string;
  risk: string;
};

type RecruiterView = {
  strengths: string[];
  weaknesses: string[];
  risks: string[];
};

type AnalysisResult = {
  parsed: ParsedResume;
  jobs: MatchedJob[];
  demand: DemandResult;
  risk: RiskResult;
  timeline: FuturePoint[];
  futureSummary: string;
  careerScore: CareerScoreResult;
  simulations: { skill: string; scoreGain: number; impact: string }[];
  safeJobs: SafeRole[];
  hiddenOpportunities: string[];
  recruiterView: RecruiterView;
  learningPath: string[];
  timeToHire: string;
  integrationFlag?: string;
};

type BackendSkillEvidence = {
  name: string;
  confidence: number;
  source?: string;
  section?: string;
};

type BackendRoleRecommendation = {
  title: string;
  score: number;
  reason: string;
};

type BackendJobMatch = {
  role: string;
  company: string;
  match_score: number;
  matching_explicit_skills: string[];
  matching_inferred_skills: string[];
  reason: string;
};

type BackendResumeAnalysis = {
  raw_text?: string;
  selectedDomain?: string;
  explicit_skills?: BackendSkillEvidence[];
  inferred_skills?: BackendSkillEvidence[];
  recommended_roles?: BackendRoleRecommendation[];
  similar_job_matches?: BackendJobMatch[];
  career_score?: number;
  ai_risk?: number;
  market_demand?: number;
  time_to_hire_weeks?: number[];
  jobs?: StoredJobRecord[];
  test_flag?: string;
};

function readJsonFromStorage<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function uniqueItems(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeSkill(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function inferDomainFromJob(job: StoredJobRecord) {
  const source = [job.title, job.description, ...(job.requirements ?? [])]
    .filter(Boolean)
    .join(" ");
  return detectDomain(source);
}

function readStoredJobs(): StoredJobRecord[] {
  const value = readJsonFromStorage<StoredJobRecord[] | { jobs?: StoredJobRecord[] }>("jobData");
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.jobs)) return value.jobs;
  return [];
}

function readStoredResumeAnalysis(): BackendResumeAnalysis | null {
  return readJsonFromStorage<BackendResumeAnalysis>("resumeAnalysis");
}

function detectDomain(resumeText: string, storedDomain?: string | null) {
  const hint = (storedDomain || "").toLowerCase();
  if (hint.includes("design")) return "design";
  if (hint.includes("data")) return "data";
  if (hint.includes("market")) return "marketing";
  if (hint.includes("business") || hint.includes("analyst")) return "business";
  if (hint.includes("software") || hint.includes("developer") || hint.includes("engineer")) return "software";

  const lower = resumeText.toLowerCase();
  if (/(figma|wireframe|prototype|ux|ui design)/.test(lower)) return "design";
  if (/(python|sql|tableau|power bi|machine learning|data)/.test(lower)) return "data";
  if (/(seo|content|campaign|crm|marketing)/.test(lower)) return "marketing";
  if (/(excel|operations|stakeholder|business)/.test(lower)) return "business";
  return "software";
}

function extractResumeSource() {
  const builderFlow = readJsonFromStorage<{
    analysisResumeText?: string;
    selectedRole?: string;
    editorFormData?: { skills?: string[]; name?: string; education?: string };
  }>("resume_builder_flow_v1");
  const resumeAnalysis = readJsonFromStorage<{ resumeText?: string; selectedDomain?: string }>("resumeAnalysis");
  const jobData = readJsonFromStorage<{ resumeText?: string; domain?: string }>("jobData");
  const profile = readJsonFromStorage<{ topTraits?: string[] }>("psychometric_profile");
  const storedJobs = readStoredJobs();

  const builderSkills = builderFlow?.editorFormData?.skills ?? [];
  const profileSkills = profile?.topTraits?.map(titleCase) ?? [];
  const storedJobText = storedJobs
    .flatMap((job) => [job.title, job.company, job.description, ...(job.requirements ?? [])])
    .filter(Boolean)
    .join(" ");
  const fallbackText = [
    builderFlow?.analysisResumeText,
    builderFlow?.selectedRole,
    builderFlow?.editorFormData?.name,
    builderFlow?.editorFormData?.education,
    storedJobText,
    ...builderSkills,
    ...profileSkills,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    resumeText:
      builderFlow?.analysisResumeText ||
      resumeAnalysis?.resumeText ||
      jobData?.resumeText ||
      fallbackText ||
      "Software developer with experience in React JavaScript TypeScript APIs teamwork problem solving and modern product development.",
    selectedDomain:
      builderFlow?.selectedRole || resumeAnalysis?.selectedDomain || jobData?.domain || null,
    storedJobs,
  };
}

function parseResume(resumeText: string, selectedDomain?: string | null): ParsedResume {
  const lower = resumeText.toLowerCase();
  const skillPool = uniqueItems(
    JOB_CORPUS.flatMap((job) => job.requiredSkills)
      .concat(["Communication", "Problem Solving", "Leadership", "Git", "APIs", "Java", "Python", "SQL"])
      .map(normalizeSkill),
  );

  const topSkills = skillPool.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 8);
  const domain = detectDomain(resumeText, selectedDomain);
  const hotSkills = HOT_SKILLS[domain as keyof typeof HOT_SKILLS] ?? HOT_SKILLS.software;
  const gapAreas = hotSkills.filter((skill) => !topSkills.some((value) => value.toLowerCase() === skill.toLowerCase())).slice(0, 5);
  const expMatch = resumeText.match(/(\d+)\+?\s*(?:years|yrs|year)/i);
  const experienceYears = expMatch ? Number(expMatch[1]) : clamp(Math.round(topSkills.length / 2), 1, 8);

  return {
    name: "Candidate",
    experienceYears,
    topSkills: topSkills.length ? topSkills : hotSkills.slice(0, 4),
    education: /b\.?tech|bachelor|master|mba|degree|engineering/i.test(resumeText) ? "Degree detected" : "Education details not explicit",
    domain,
    gapAreas,
    resumeText,
  };
}

function matchJobs(parsed: ParsedResume, storedJobs: StoredJobRecord[]): MatchedJob[] {
  const jobSource = storedJobs.length
    ? storedJobs.map((job) => ({
        title: job.title ?? "Untitled role",
        type: job.type ?? "Remote",
        location: job.location ?? "India",
        domain: inferDomainFromJob(job),
        requiredSkills: Array.isArray(job.requirements) && job.requirements.length ? job.requirements : parsed.topSkills,
        reason: job.description ?? "Good alignment with your current skill profile.",
        aiRisk: typeof job.aiRisk === "number" ? job.aiRisk : 32,
        company: job.company,
        salary: job.salary,
        posted: job.posted,
      }))
    : JOB_CORPUS;

  const matchedJobs = jobSource.map((job) => {
    const overlap = job.requiredSkills.filter((skill) =>
      parsed.topSkills.some((value) => value.toLowerCase() === skill.toLowerCase()),
    ).length;
    const domainBonus = job.domain === parsed.domain ? 18 : 6;
    const experienceBonus = clamp(parsed.experienceYears * 3, 4, 18);
    const matchPct = clamp(Math.round((overlap / job.requiredSkills.length) * 55 + domainBonus + experienceBonus), 46, 96);

    return {
      title: job.title,
      matchPct,
      reason: overlap > 0 ? `${overlap} matching core skills including ${job.requiredSkills.slice(0, 2).join(" and ")}.` : job.reason,
      type: job.type,
      location: job.location,
      aiRisk: job.aiRisk,
      company: "company" in job ? job.company : undefined,
      salary: "salary" in job ? job.salary : undefined,
      posted: "posted" in job ? job.posted : undefined,
    };
  });

  if (storedJobs.length) {
    return matchedJobs.slice(0, Math.min(matchedJobs.length, 10));
  }

  return matchedJobs
    .sort((a, b) => b.matchPct - a.matchPct)
    .slice(0, 5);
}

function analyzeDemand(parsed: ParsedResume): DemandResult {
  const hotSkills = HOT_SKILLS[parsed.domain as keyof typeof HOT_SKILLS] ?? HOT_SKILLS.software;
  const overlap = hotSkills.filter((skill) =>
    parsed.topSkills.some((value) => value.toLowerCase() === skill.toLowerCase()),
  ).length;
  const demandScore = clamp(Math.round(58 + overlap * 8 + parsed.experienceYears * 2), 52, 95);
  const demandLabel = demandScore >= 80 ? "High" : demandScore >= 65 ? "Stable" : "Growing";

  return {
    demandScore,
    demandLabel,
    hotSkills,
    marketInsight: `${parsed.domain === "software" ? "Product teams" : "Hiring teams"} continue to value candidates with applied skills and adaptable execution.`,
  };
}

function scoreAiRisk(parsed: ParsedResume): RiskResult {
  const automationPenalty = parsed.topSkills.filter((skill) =>
    ["Excel", "SEO", "Data Entry", "Reporting", "Content Strategy", "SQL"].includes(skill),
  ).length;
  const creativityOffset = parsed.topSkills.filter((skill) =>
    ["React", "Figma", "UX Research", "Leadership", "Problem Solving", "Communication"].includes(skill),
  ).length;
  const riskPct = clamp(Math.round(34 + automationPenalty * 6 - creativityOffset * 4), 18, 74);
  const riskLabel = riskPct <= 30 ? "Low" : riskPct <= 50 ? "Medium" : "High";

  return {
    riskPct,
    riskLabel,
    verdict:
      riskLabel === "Low"
        ? "Your profile leans toward collaborative and judgment-heavy work."
        : riskLabel === "Medium"
          ? "Your profile is resilient, but adding differentiated skills will strengthen it."
          : "Your path can improve by shifting toward higher-creativity and strategic work.",
  };
}

function predictFuture(risk: RiskResult): { timeline: FuturePoint[]; summary: string } {
  const timeline = [2026, 2027, 2028, 2029, 2030].map((year, index) => {
    const riskPct = clamp(risk.riskPct + index * 4 - 3, 15, 85);
    const label = riskPct <= 30 ? "Low" : riskPct <= 50 ? "Medium" : "High";
    return { year, riskPct, label };
  });

  return {
    timeline,
    summary: `Projected automation exposure stays ${timeline[0].label.toLowerCase()} to ${timeline[timeline.length - 1].label.toLowerCase()} if your skills remain unchanged.`,
  };
}

function computeCareerScore(parsed: ParsedResume, jobs: MatchedJob[], demand: DemandResult, risk: RiskResult): CareerScoreResult {
  const skillMatch = jobs.length ? Math.round(jobs.reduce((sum, job) => sum + job.matchPct, 0) / jobs.length) : 60;
  const aiSafety = 100 - risk.riskPct;
  const experience = clamp(parsed.experienceYears * 12, 20, 100);
  const score = clamp(Math.round(skillMatch * 0.35 + demand.demandScore * 0.25 + aiSafety * 0.2 + experience * 0.2), 48, 95);

  return {
    score,
    verdict: score >= 80 ? "Strong short-term hiring position." : score >= 65 ? "Promising with a few focused improvements." : "Build depth in the highlighted areas to lift your outcomes.",
    skillMatch,
  };
}

function simulateWhatIf(parsed: ParsedResume, careerScore: CareerScoreResult, demand: DemandResult) {
  return demand.hotSkills
    .filter((skill) => !parsed.topSkills.some((value) => value.toLowerCase() === skill.toLowerCase()))
    .slice(0, 3)
    .map((skill, index) => ({
      skill,
      scoreGain: 4 + index * 2,
      impact: `If you add ${skill}, score goes +${4 + index * 2} -> ${clamp(careerScore.score + 4 + index * 2, 0, 100)}.`,
    }));
}

function recommendSafeJobs(parsed: ParsedResume): SafeRole[] {
  const rolePool: Record<string, SafeRole[]> = {
    software: [
      { title: "Solutions Engineer", fit: "Good fit for technical communication and problem solving.", risk: "Low risk" },
      { title: "Product Engineer", fit: "Blends building, iteration, and cross-team judgment.", risk: "Low risk" },
      { title: "Developer Advocate", fit: "Rewards teaching, storytelling, and technical depth.", risk: "Low risk" },
    ],
    data: [
      { title: "Analytics Consultant", fit: "Combines insights with stakeholder communication.", risk: "Low risk" },
      { title: "Product Analyst", fit: "Strong option for decision-oriented analytical work.", risk: "Low risk" },
      { title: "Business Intelligence Lead", fit: "Higher-trust role focused on context and judgment.", risk: "Low risk" },
    ],
    design: [
      { title: "UX Strategist", fit: "Research and synthesis remain highly resilient.", risk: "Low risk" },
      { title: "Product Designer", fit: "Strong fit for systems thinking and creativity.", risk: "Low risk" },
      { title: "Service Designer", fit: "Great path for broader journey and process design.", risk: "Low risk" },
    ],
    marketing: [
      { title: "Brand Strategist", fit: "Creative positioning is harder to automate.", risk: "Low risk" },
      { title: "Growth Manager", fit: "Blends experimentation with business context.", risk: "Low risk" },
      { title: "Community Lead", fit: "Human trust and messaging are central here.", risk: "Low risk" },
    ],
    business: [
      { title: "Program Manager", fit: "Cross-functional coordination is highly durable.", risk: "Low risk" },
      { title: "Operations Manager", fit: "Judgment-heavy execution remains resilient.", risk: "Low risk" },
      { title: "Customer Success Lead", fit: "Relationship-led problem solving is valuable.", risk: "Low risk" },
    ],
  };

  return rolePool[parsed.domain] ?? rolePool.software;
}

function findHiddenOpportunities(parsed: ParsedResume) {
  const opportunities: Record<string, string[]> = {
    software: ["Technical Product Analyst", "Implementation Consultant", "QA Automation Specialist"],
    data: ["Revenue Operations Analyst", "Fraud Analytics Associate", "Customer Insights Analyst"],
    design: ["Design Research Coordinator", "Content Designer", "UX Writer"],
    marketing: ["Lifecycle Marketing Specialist", "Partnerships Associate", "Customer Education Manager"],
    business: ["Business Systems Analyst", "Project Coordinator", "Operations Strategy Associate"],
  };

  return opportunities[parsed.domain] ?? opportunities.software;
}

function buildRecruiterView(parsed: ParsedResume, demand: DemandResult): RecruiterView {
  return {
    strengths: [
      `${parsed.experienceYears}+ years of transferable experience`,
      `Visible strengths in ${parsed.topSkills.slice(0, 3).join(", ")}`,
      `${demand.demandLabel} demand alignment in current market`,
    ],
    weaknesses: [
      parsed.gapAreas[0] ? `Needs stronger depth in ${parsed.gapAreas[0]}` : "Needs more clearly differentiated specialist skill",
      "Resume could show more quantified impact",
      "Portfolio or proof-of-work signals can be stronger",
    ],
    risks: [
      "Competing candidates may show more recent tooling depth",
      "Generic skill phrasing may reduce recruiter confidence",
      "Interview readiness will matter for top-match roles",
    ],
  };
}

function buildLearningPath(parsed: ParsedResume, demand: DemandResult) {
  return [
    `Audit your current resume around ${parsed.topSkills.slice(0, 2).join(" and ")} outcomes.`,
    `Add one in-demand capability such as ${demand.hotSkills[0]}.`,
    "Build a focused proof-of-work project in your target role.",
    "Quantify impact with metrics recruiters can scan quickly.",
    "Apply to adjacent high-fit roles and refine based on response patterns.",
  ];
}

function estimateTimeToHire(score: number, demandScore: number) {
  const fastTrack = score >= 80 && demandScore >= 75;
  return fastTrack ? "4-10 weeks" : score >= 68 ? "8-18 weeks" : "12-24 weeks";
}

function inferDomainFromRoles(roles: BackendRoleRecommendation[] = []) {
  const topRole = roles[0]?.title?.toLowerCase() ?? "";
  if (/(project|program|pmo)/.test(topRole)) return "business";
  if (/operations/.test(topRole)) return "business";
  if (/(designer|ux|ui)/.test(topRole)) return "design";
  if (/(data|analyst)/.test(topRole)) return "data";
  if (/(developer|engineer)/.test(topRole)) return "software";
  return "business";
}

function buildTimelineFromRisk(riskPct: number): FuturePoint[] {
  return [2026, 2027, 2028, 2029, 2030].map((year, index) => {
    const projected = clamp(riskPct + index * 4 - 3, 15, 85);
    return {
      year,
      riskPct: projected,
      label: projected <= 30 ? "Low" : projected <= 50 ? "Medium" : "High",
    };
  });
}

function mapStoredJobByTitle(storedJobs: StoredJobRecord[]) {
  const mapping = new Map<string, StoredJobRecord>();
  storedJobs.forEach((job) => {
    if (job.title) {
      mapping.set(job.title.trim().toLowerCase(), job);
    }
  });
  return mapping;
}

function buildAnalysisFromBackend(backend: BackendResumeAnalysis, storedJobs: StoredJobRecord[]): AnalysisResult {
  const explicitSkills = backend.explicit_skills ?? [];
  const inferredSkills = backend.inferred_skills ?? [];
  const recommendedRoles = backend.recommended_roles ?? [];
  const domain = inferDomainFromRoles(recommendedRoles);
  const parsed = parseResume(backend.raw_text ?? "", backend.selectedDomain ?? domain);
  parsed.domain = domain;
  parsed.topSkills = explicitSkills.map((item) => item.name);
  parsed.gapAreas = inferredSkills.map((item) => item.name);
  parsed.resumeText = backend.raw_text ?? parsed.resumeText;

  const jobLookup = mapStoredJobByTitle(storedJobs);
  const jobs: MatchedJob[] = (backend.similar_job_matches ?? []).map((jobMatch) => {
    const linkedJob = jobLookup.get(jobMatch.role.trim().toLowerCase());
    const matchingCoreSkills = jobMatch.matching_explicit_skills.length
      ? `${jobMatch.matching_explicit_skills.length} matching explicit skills: ${jobMatch.matching_explicit_skills.join(", ")}.`
      : "";

    return {
      title: jobMatch.role,
      matchPct: Math.round(jobMatch.match_score * 100),
      reason: [jobMatch.reason, matchingCoreSkills].filter(Boolean).join(" "),
      type: (linkedJob?.type as MatchedJob["type"]) ?? "Remote",
      location: linkedJob?.location ?? "India",
      aiRisk: linkedJob?.aiRisk ?? Math.max((backend.ai_risk ?? 42) - 5, 18),
      company: jobMatch.company || linkedJob?.company,
      salary: linkedJob?.salary ?? "Not specified",
      posted: linkedJob?.posted ?? "Recently",
    };
  });

  const demandScore = backend.market_demand ?? 60;
  const riskPct = backend.ai_risk ?? 42;
  const timeline = buildTimelineFromRisk(riskPct);
  const timeToHireWeeks = backend.time_to_hire_weeks ?? [12, 24];
  const demand: DemandResult = {
    demandScore,
    demandLabel: demandScore >= 80 ? "High" : demandScore >= 65 ? "Stable" : "Growing",
    hotSkills: explicitSkills.map((item) => item.name).slice(0, 5),
    marketInsight: recommendedRoles[0]?.reason ?? "Demand is based on your strongest aligned roles and explicit skills.",
  };
  const risk: RiskResult = {
    riskPct,
    riskLabel: riskPct <= 30 ? "Low" : riskPct <= 50 ? "Medium" : "High",
    verdict:
      riskPct <= 30
        ? "Your profile leans toward collaborative and judgment-heavy work."
        : riskPct <= 50
          ? "Your profile is resilient, but adding differentiated skills will strengthen it."
          : "Your path can improve by shifting toward higher-creativity and strategic work.",
  };
  const careerScoreValue = backend.career_score ?? 60;
  const careerScore: CareerScoreResult = {
    score: careerScoreValue,
    verdict:
      careerScoreValue >= 80
        ? "Strong short-term hiring position."
        : careerScoreValue >= 65
          ? "Promising with a few focused improvements."
          : "Build depth in the highlighted areas to lift your outcomes.",
    skillMatch: jobs.length ? Math.round(jobs.reduce((sum, job) => sum + job.matchPct, 0) / jobs.length) : careerScoreValue,
  };

  console.info("resume-processing using backend analysis", {
    explicitSkills: explicitSkills.map((item) => item.name),
    inferredSkills: inferredSkills.map((item) => item.name),
    recommendedRoles: recommendedRoles.map((item) => item.title),
    similarJobMatches: jobs.map((job) => job.title),
  });

  return {
    parsed,
    jobs,
    demand,
    risk,
    timeline,
    futureSummary: `Projected automation exposure stays ${timeline[0].label.toLowerCase()} to ${timeline[timeline.length - 1].label.toLowerCase()} if your skills remain unchanged.`,
    careerScore,
    simulations: inferredSkills.slice(0, 3).map((skill, index) => ({
      skill: skill.name,
      scoreGain: 3 + index * 2,
      impact: `If you strengthen ${skill.name}, score may improve by ${3 + index * 2} points with stronger role evidence.`,
    })),
    safeJobs: recommendedRoles.slice(0, 3).map((role) => ({
      title: role.title,
      fit: role.reason,
      risk: risk.riskLabel === "Low" ? "Low risk" : "Moderate risk",
    })),
    hiddenOpportunities: recommendedRoles.slice(1, 4).map((role) => role.title),
    recruiterView: {
      strengths: [
        ...explicitSkills.slice(0, 3).map((item) => `Explicit evidence for ${item.name}`),
        recommendedRoles[0]?.reason ?? "Strong role alignment in the resume objective.",
      ],
      weaknesses: [
        inferredSkills[0] ? `Some signals are inferred rather than explicit, such as ${inferredSkills[0].name}.` : "Needs more measurable proof-of-work outcomes.",
        "Resume could show more quantified impact.",
        "Formal experience is still early-stage for target roles.",
      ],
      risks: [
        "Overstating loosely inferred skills can reduce recruiter confidence.",
        "PM roles will still expect stronger proof of execution over time.",
        "Interview readiness will matter for top-match roles.",
      ],
    },
    learningPath: [
      "Strengthen project coordination proof points with measurable outcomes.",
      "Keep building PM-oriented no-code / AI prototypes with clear delivery ownership.",
      "Add quantifiable leadership and event-coordination impact to the resume.",
      "Apply first to coordinator, PM trainee, and business-operations entry roles.",
      "Use certification-backed terms only where you can show practical evidence.",
    ],
    timeToHire: `${timeToHireWeeks[0]}-${timeToHireWeeks[1]} weeks`,
    integrationFlag: backend.test_flag,
  };
}

function runRoleRadarAnalysis(): AnalysisResult {
  const { resumeText, selectedDomain, storedJobs } = extractResumeSource();
  const backendAnalysis = readStoredResumeAnalysis();
  if (backendAnalysis?.recommended_roles?.length || backendAnalysis?.similar_job_matches?.length) {
    return buildAnalysisFromBackend(backendAnalysis, storedJobs);
  }
  const parsed = parseResume(resumeText, selectedDomain);
  const jobs = matchJobs(parsed, storedJobs);
  const demand = analyzeDemand(parsed);
  const risk = scoreAiRisk(parsed);
  const future = predictFuture(risk);
  const careerScore = computeCareerScore(parsed, jobs, demand, risk);
  const simulations = simulateWhatIf(parsed, careerScore, demand);
  const safeJobs = recommendSafeJobs(parsed);
  const hiddenOpportunities = findHiddenOpportunities(parsed);
  const recruiterView = buildRecruiterView(parsed, demand);
  const learningPath = buildLearningPath(parsed, demand);
  const timeToHire = estimateTimeToHire(careerScore.score, demand.demandScore);

  return {
    parsed,
    jobs,
    demand,
    risk,
    timeline: future.timeline,
    futureSummary: future.summary,
    careerScore,
    simulations,
    safeJobs,
    hiddenOpportunities,
    recruiterView,
    learningPath,
    timeToHire,
  };
}

export default function ResumeProcessing() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const completedSteps = useMemo(
    () => PROCESSING_STEPS.map((_, index) => index < currentStep),
    [currentStep],
  );

  useEffect(() => {
    const stepInterval = window.setInterval(() => {
      setCurrentStep((value) =>
        value < PROCESSING_STEPS.length - 1 ? value + 1 : value,
      );
    }, STEP_DURATION_MS);

    const progressInterval = window.setInterval(() => {
      setProgress((value) => {
        if (value >= 100) {
          return 100;
        }

        return Math.min(value + 100 / (TOTAL_DURATION_MS / 100), 100);
      });
    }, 100);

    const timeout = window.setTimeout(() => {
      setIsComplete(true);
    }, TOTAL_DURATION_MS);

    return () => {
      window.clearInterval(stepInterval);
      window.clearInterval(progressInterval);
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!isComplete || analysis) {
      return;
    }

    setAnalysis(runRoleRadarAnalysis());
  }, [analysis, isComplete]);

  const topMatches = analysis?.jobs.slice(0, 2) ?? [];
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <h1 className="font-['Poppins:Bold',sans-serif] text-3xl text-neutral-800">
              Analyzing your resume...
            </h1>
            <p className="mt-2 font-['Poppins:Regular',sans-serif] text-neutral-600">
              Our AI is preparing your insights
            </p>
            {analysis?.integrationFlag ? (
              <p className="mt-2 font-['Poppins:Medium',sans-serif] text-sm text-emerald-600">
                {analysis.integrationFlag}
              </p>
            ) : null}
          </div>

          <div className="mt-10 flex justify-center">
            <motion.div
              className="h-14 w-14 rounded-full border-4 border-neutral-200 border-t-black"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-sm font-['Poppins:Medium',sans-serif] text-neutral-700">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <motion.div
                className="h-full bg-black"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-neutral-200 p-5">
            <AnimatePresence mode="wait">
              <motion.p
                key={PROCESSING_STEPS[currentStep]}
                className="text-center font-['Poppins:Medium',sans-serif] text-neutral-800"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {PROCESSING_STEPS[currentStep]}
              </motion.p>
            </AnimatePresence>

            <div className="mt-6 space-y-3">
              {PROCESSING_STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isStepComplete = completedSteps[index];

                return (
                  <div
                    key={step}
                    className={`flex items-center gap-3 text-sm transition-colors ${
                      isActive
                        ? "text-black"
                        : isStepComplete
                          ? "text-neutral-700"
                          : "text-neutral-400"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
                        isStepComplete || isActive
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 bg-white text-neutral-400"
                      }`}
                    >
                      {isStepComplete ? "✓" : index + 1}
                    </div>
                    <span
                      className={`font-['Poppins:Regular',sans-serif] ${
                        isActive ? "font-semibold" : ""
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {isComplete && analysis ? (
              <motion.div
                className="mt-8 space-y-6 text-left"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <div className="rounded-2xl border border-neutral-200 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black bg-black text-white">
                      ✓
                    </div>
                    <div>
                      <p className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-900">
                        Analysis Complete
                      </p>
                      <p className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-600">
                        Your resume insights are ready for review.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Career Score" value={`${analysis.careerScore.score} / 100`} detail={analysis.careerScore.verdict} />
                  <MetricCard label="AI Risk" value={`${analysis.risk.riskPct}% · ${analysis.risk.riskLabel}`} detail={analysis.risk.verdict} />
                  <MetricCard label="Market Demand" value={`${analysis.demand.demandScore} / 100`} detail={`${analysis.demand.demandLabel} demand`} />
                  <MetricCard label="Time to Hire" value={analysis.timeToHire} detail="Estimated based on fit and demand" />
                </div>

                <div className="space-y-3">
                  <p className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-900">
                    Similar job matches
                  </p>
                  {topMatches.map((job) => (
                    <div key={job.title} className="rounded-2xl border border-neutral-200 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-900">
                            {job.title}
                          </p>
                          {job.company ? (
                            <p className="mt-1 font-['Poppins:Regular',sans-serif] text-sm text-neutral-500">
                              {job.company}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                            <span>{job.location}</span>
                            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-['Poppins:Medium',sans-serif] text-neutral-700">
                              {job.type}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full border border-black px-3 py-1 text-xs font-['Poppins:Bold',sans-serif] text-neutral-900">
                          {job.matchPct}% match
                        </span>
                      </div>
                      <p className="mt-3 font-['Poppins:Regular',sans-serif] text-sm text-neutral-700">
                        {job.reason}
                      </p>
                      <p className="mt-2 font-['Poppins:Medium',sans-serif] text-sm text-neutral-600">
                        Role risk: {job.aiRisk}%
                      </p>
                      {job.salary || job.posted ? (
                        <p className="mt-1 font-['Poppins:Regular',sans-serif] text-xs text-neutral-500">
                          {[job.salary, job.posted].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-neutral-200 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="font-['Poppins:Bold',sans-serif] text-lg text-neutral-900">
                        AI Risk Prediction
                      </p>
                      <p className="mt-1 font-['Poppins:Bold',sans-serif] text-2xl text-neutral-900">
                        {analysis.risk.riskPct}% · {analysis.risk.riskLabel}
                      </p>
                    </div>
                    <p className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-600">
                      {analysis.risk.verdict}
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-neutral-200 p-4">
                    <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                      <span>AI automation exposure by year</span>
                      <span>Risk % histogram</span>
                    </div>
                    <div className="grid grid-cols-[36px_1fr] gap-3">
                      <div className="flex h-48 flex-col justify-between text-xs text-neutral-400">
                        {[100, 75, 50, 25, 0].map((tick) => (
                          <span key={tick}>{tick}</span>
                        ))}
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex flex-col justify-between">
                          {[0, 1, 2, 3, 4].map((line) => (
                            <div key={line} className="border-t border-dashed border-neutral-200" />
                          ))}
                        </div>
                        <div className="relative flex h-48 items-end justify-between gap-3">
                          {analysis.timeline.map((point) => (
                            <div key={point.year} className="flex flex-1 flex-col items-center gap-2">
                              <div className="flex h-full w-full items-end justify-center px-1">
                                <motion.div
                                  className="w-full max-w-[72px] rounded-t-xl bg-black"
                                  initial={{ height: 0 }}
                                  animate={{ height: `${point.riskPct}%` }}
                                  transition={{ duration: 0.4, ease: "easeOut" }}
                                />
                              </div>
                              <p className="font-['Poppins:Regular',sans-serif] text-xs text-neutral-500">
                                {point.year}
                              </p>
                              <p className="font-['Poppins:Medium',sans-serif] text-xs text-neutral-700">
                                {point.riskPct}% · {point.label}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 font-['Poppins:Regular',sans-serif] text-sm text-neutral-600">
                    {analysis.futureSummary}
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <button
                    type="button"
                    onClick={() => setIsExpanded((value) => !value)}
                    className="flex w-full items-center justify-between font-['Poppins:Bold',sans-serif] text-neutral-900"
                  >
                    <span>{isExpanded ? "Show Less ▴" : "Read More ▾"}</span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div
                        className="mt-5 space-y-5"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      >
                        <div className="space-y-3">
                          <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
                            All job matches
                          </p>
                          {analysis.jobs.map((job) => (
                            <div key={`${job.title}-expanded`} className="rounded-2xl border border-neutral-200 p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
                                    {job.title}
                                  </p>
                                  <p className="mt-1 font-['Poppins:Regular',sans-serif] text-sm text-neutral-600">
                                    {job.location} · {job.type}
                                  </p>
                                </div>
                                <span className="rounded-full border border-black px-3 py-1 text-xs font-['Poppins:Bold',sans-serif] text-neutral-900">
                                  {job.matchPct}% match
                                </span>
                              </div>
                              <p className="mt-2 font-['Poppins:Regular',sans-serif] text-sm text-neutral-700">
                                {job.reason}
                              </p>
                            </div>
                          ))}
                        </div>

                        <TagSection title="Skills detected" items={analysis.parsed.topSkills} />
                        <TagSection title="Skill gaps" items={analysis.parsed.gapAreas} accent="border-amber-300 bg-amber-50 text-amber-700" />
                        <TagSection title="Safe AI-resilient roles" items={analysis.safeJobs.map((job) => `${job.title} · ${job.risk}`)} />

                        <div>
                          <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
                            What-if simulations
                          </p>
                          <div className="mt-3 space-y-2">
                            {analysis.simulations.map((simulation) => (
                              <div key={simulation.skill} className="rounded-2xl border border-neutral-200 p-4 font-['Poppins:Regular',sans-serif] text-sm text-neutral-700">
                                {simulation.impact}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
                            Hidden opportunities
                          </p>
                          <div className="mt-3 space-y-2">
                            {analysis.hiddenOpportunities.map((opportunity) => (
                              <div key={opportunity} className="rounded-2xl border border-neutral-200 p-4 font-['Poppins:Regular',sans-serif] text-sm text-neutral-700">
                                • {opportunity}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
                            Recruiter view
                          </p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <ColumnList title="Strengths" items={analysis.recruiterView.strengths} />
                            <ColumnList title="Weaknesses" items={analysis.recruiterView.weaknesses} />
                            <ColumnList title="Risks" items={analysis.recruiterView.risks} />
                          </div>
                        </div>

                        <div>
                          <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
                            5-step learning path
                          </p>
                          <div className="mt-3 space-y-2">
                            {analysis.learningPath.map((step, index) => (
                              <div key={step} className="rounded-2xl border border-neutral-200 p-4">
                                <p className="font-['Poppins:Medium',sans-serif] text-sm text-neutral-900">
                                  {index + 1}. {step}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(JOB_DISCOVERY_ROUTE)}
                  className="w-full rounded-2xl border border-black bg-black px-6 py-4 font-['Poppins:Bold',sans-serif] text-white transition-transform hover:scale-[1.01]"
                >
                  Continue to Job Discovery →
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-500">
        {label}
      </p>
      <p className="mt-2 font-['Poppins:Bold',sans-serif] text-xl text-neutral-900">
        {value}
      </p>
      <p className="mt-2 font-['Poppins:Regular',sans-serif] text-xs text-neutral-600">
        {detail}
      </p>
    </div>
  );
}

function TagSection({
  title,
  items,
  accent = "border-neutral-200 bg-neutral-50 text-neutral-700",
}: {
  title: string;
  items: string[];
  accent?: string;
}) {
  return (
    <div>
      <p className="font-['Poppins:Bold',sans-serif] text-base text-neutral-900">
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={`rounded-full border px-3 py-1 text-xs font-['Poppins:Medium',sans-serif] ${accent}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ColumnList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="font-['Poppins:Bold',sans-serif] text-sm text-neutral-900">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p key={item} className="font-['Poppins:Regular',sans-serif] text-sm text-neutral-700">
            • {item}
          </p>
        ))}
      </div>
    </div>
  );
}
