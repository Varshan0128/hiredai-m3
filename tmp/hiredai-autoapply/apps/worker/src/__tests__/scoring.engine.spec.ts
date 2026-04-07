import { scoreJob, type ScoringInput } from "../scoring/scoring.engine";

const BASE_PREF: ScoringInput["preference"] = {
  targetRoles: ["Frontend Developer", "React Developer"],
  preferredLocations: ["Remote", "London"],
  minSalary: 60000,
  maxSalary: 130000,
  workModes: ["remote", "hybrid"],
  companyTypes: ["startup", "product_based"],
  experienceLevels: ["junior", "mid"],
  minimumMatchScore: 65,
  fullyAutomatic: true,
  maxApplicationsPerDay: 10,
  maxApplicationsPerWeek: 40,
  postingDateFrom: null,
  postingDateTo: null,
};

const BASE_JOB: ScoringInput["job"] = {
  id: "job-1",
  title: "Frontend Developer",
  description: "React TypeScript NodeJS developer needed",
  location: "Remote",
  normalizedLocation: "remote",
  salaryMin: 70000,
  salaryMax: 100000,
  workMode: "remote",
  companyType: "startup",
  experienceLevel: "mid",
  skills: ["react", "typescript", "nodejs"],
  postedAt: new Date(),
  expiresAt: null,
  isActive: true,
  applyUrl: "https://example.com/apply",
  sourceProvider: "adzuna",
};

const BASE_INPUT: ScoringInput = {
  preference: BASE_PREF,
  job: BASE_JOB,
  resumeSkills: ["react", "typescript", "javascript", "nodejs", "css"],
  resumeRoleTag: "frontend developer",
  resumeId: "resume-1",
  alreadyApplied: false,
  applicationsToday: 0,
  applicationsThisWeek: 0,
};

describe("Scoring Engine", () => {
  describe("auto_apply decision", () => {
    it("returns auto_apply for a strong match with fully automatic mode", () => {
      const result = scoreJob(BASE_INPUT);
      expect(result.decision).toBe("auto_apply");
      expect(result.matchScore).toBeGreaterThanOrEqual(65);
      expect(result.explanation.decisionReason).toContain("threshold");
    });

    it("returns high score when all dimensions match", () => {
      const result = scoreJob(BASE_INPUT);
      expect(result.matchScore).toBeGreaterThan(75);
    });

    it("includes correct matched skills in explanation", () => {
      const result = scoreJob(BASE_INPUT);
      expect(result.explanation.matchedSkills).toContain("react");
      expect(result.explanation.matchedSkills).toContain("typescript");
    });
  });

  describe("needs_review decision", () => {
    it("returns needs_review when fullyAutomatic is false", () => {
      const result = scoreJob({ ...BASE_INPUT, preference: { ...BASE_PREF, fullyAutomatic: false } });
      expect(result.decision).toBe("needs_review");
    });

    it("returns needs_review when job has no salary data", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        job: { ...BASE_JOB, salaryMin: null, salaryMax: null },
      });
      expect(result.decision).toBe("needs_review");
    });

    it("returns needs_review when job has no applyUrl", () => {
      const result = scoreJob({ ...BASE_INPUT, job: { ...BASE_JOB, applyUrl: null } });
      expect(result.decision).toBe("needs_review");
    });

    it("returns needs_review when workMode is null", () => {
      const result = scoreJob({ ...BASE_INPUT, job: { ...BASE_JOB, workMode: null } });
      expect(result.decision).toBe("needs_review");
    });
  });

  describe("skip decision", () => {
    it("skips when score is below minimumMatchScore", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        preference: { ...BASE_PREF, minimumMatchScore: 99 },
      });
      expect(result.decision).toBe("skip");
      expect(result.explanation.decisionReason).toContain("below");
    });

    it("skips when already applied", () => {
      const result = scoreJob({ ...BASE_INPUT, alreadyApplied: true });
      expect(result.decision).toBe("skip");
      expect(result.explanation.decisionReason).toContain("Already applied");
    });

    it("skips when job is inactive", () => {
      const result = scoreJob({ ...BASE_INPUT, job: { ...BASE_JOB, isActive: false } });
      expect(result.decision).toBe("skip");
      expect(result.explanation.decisionReason).toContain("inactive");
    });

    it("skips when job is expired", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        job: { ...BASE_JOB, expiresAt: new Date(Date.now() - 86400000) },
      });
      expect(result.decision).toBe("skip");
      expect(result.explanation.decisionReason).toContain("expired");
    });

    it("skips on role mismatch", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        job: { ...BASE_JOB, title: "Java Backend Engineer" },
      });
      expect(result.decision).toBe("skip");
      expect(result.explanation.decisionReason).toContain("Role mismatch");
    });

    it("skips when daily limit reached", () => {
      const result = scoreJob({ ...BASE_INPUT, applicationsToday: 10 });
      expect(result.decision).toBe("skip");
      expect(result.explanation.decisionReason).toContain("Daily limit");
    });

    it("skips when work mode doesn't match preference", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        job: { ...BASE_JOB, workMode: "onsite" },
        preference: { ...BASE_PREF, workModes: ["remote"] },
      });
      expect(result.decision).toBe("skip");
    });
  });

  describe("score components", () => {
    it("gives high role fit score for exact title match", () => {
      const result = scoreJob(BASE_INPUT);
      expect(result.explanation.roleFitScore).toBeGreaterThan(80);
    });

    it("gives high skill fit when all job skills are in resume", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        resumeSkills: ["react", "typescript", "nodejs"],
        job: { ...BASE_JOB, skills: ["react", "typescript", "nodejs"] },
      });
      expect(result.explanation.skillFitScore).toBe(100);
    });

    it("gives low skill fit when no resume skills match", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        resumeSkills: ["java", "spring"],
        job: { ...BASE_JOB, skills: ["react", "typescript"] },
      });
      expect(result.explanation.skillFitScore).toBe(0);
      expect(result.explanation.missingSkills).toContain("react");
    });

    it("gives 100 location score for remote matching remote preference", () => {
      const result = scoreJob(BASE_INPUT);
      expect(result.explanation.locationFitScore).toBe(100);
    });

    it("gives low location score for non-matching location", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        job: { ...BASE_JOB, location: "Tokyo", normalizedLocation: "tokyo" },
        preference: { ...BASE_PREF, preferredLocations: ["Remote", "London"] },
      });
      expect(result.explanation.locationFitScore).toBeLessThan(50);
    });

    it("skips when salary is below minimum", () => {
      const result = scoreJob({
        ...BASE_INPUT,
        job: { ...BASE_JOB, salaryMin: 20000, salaryMax: 30000 },
        preference: { ...BASE_PREF, minimumMatchScore: 0 }, // lower threshold to isolate
      });
      expect(result.explanation.salaryFitScore).toBeLessThan(50);
    });
  });

  describe("resumeId propagation", () => {
    it("includes resumeId in result", () => {
      const result = scoreJob({ ...BASE_INPUT, resumeId: "resume-abc" });
      expect(result.resumeId).toBe("resume-abc");
    });

    it("returns null resumeId when none provided", () => {
      const result = scoreJob({ ...BASE_INPUT, resumeId: null });
      expect(result.resumeId).toBeNull();
    });
  });
});
