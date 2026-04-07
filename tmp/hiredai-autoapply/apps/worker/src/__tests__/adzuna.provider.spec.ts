import { AdzunaProvider } from "../providers/adzuna.provider";

const provider = new AdzunaProvider("test-id", "test-key");

const RAW_JOB = {
  id: "12345678",
  title: "Senior Frontend Developer",
  company: { display_name: "Tech Startup Ltd" },
  location: { display_name: "London, UK" },
  description: "We need a senior React developer with TypeScript experience. Remote friendly. Junior to mid-level welcome.",
  redirect_url: "https://www.adzuna.co.uk/jobs/details/12345678",
  created: "2024-06-01T09:00:00Z",
  salary_min: 70000,
  salary_max: 95000,
  contract_type: "permanent",
};

describe("AdzunaProvider", () => {
  it("returns correct source name", () => {
    expect(provider.getSourceName()).toBe("adzuna");
  });

  describe("normalizeJob", () => {
    let normalized: ReturnType<typeof provider.normalizeJob>;

    beforeEach(() => {
      normalized = provider.normalizeJob(RAW_JOB as any);
    });

    it("maps externalId correctly", () => {
      expect(normalized.externalId).toBe("12345678");
    });

    it("sets sourceProvider to adzuna", () => {
      expect(normalized.sourceProvider).toBe("adzuna");
    });

    it("maps title", () => {
      expect(normalized.title).toBe("Senior Frontend Developer");
    });

    it("maps company name", () => {
      expect(normalized.companyName).toBe("Tech Startup Ltd");
    });

    it("maps location", () => {
      expect(normalized.location).toBe("London, UK");
    });

    it("normalizes location to lowercase", () => {
      expect(normalized.normalizedLocation).toBe("london, uk");
    });

    it("maps salary correctly", () => {
      expect(normalized.salaryMin).toBe(70000);
      expect(normalized.salaryMax).toBe(95000);
      expect(normalized.currency).toBe("GBP");
    });

    it("maps apply URL", () => {
      expect(normalized.applyUrl).toBe("https://www.adzuna.co.uk/jobs/details/12345678");
    });

    it("maps postedAt date", () => {
      expect(normalized.postedAt).toBeInstanceOf(Date);
      expect(normalized.postedAt?.getFullYear()).toBe(2024);
    });

    it("infers remote work mode from description", () => {
      expect(normalized.workMode).toBe("remote");
    });

    it("extracts skills from description", () => {
      expect(normalized.skills).toContain("react");
      expect(normalized.skills).toContain("typescript");
    });

    it("generates a dedupeKey", () => {
      expect(normalized.dedupeKey).toBeTruthy();
      expect(typeof normalized.dedupeKey).toBe("string");
    });

    it("stores rawPayload", () => {
      expect(normalized.rawPayload).toEqual(RAW_JOB);
    });

    it("handles missing salary gracefully", () => {
      const jobNoSalary = { ...RAW_JOB, salary_min: undefined, salary_max: undefined };
      const result = provider.normalizeJob(jobNoSalary as any);
      expect(result.salaryMin).toBeNull();
      expect(result.salaryMax).toBeNull();
    });

    it("handles missing company gracefully", () => {
      const jobNoCompany = { ...RAW_JOB, company: undefined };
      const result = provider.normalizeJob(jobNoCompany as any);
      expect(result.companyName).toBe("Unknown");
    });
  });

  describe("extractApplyUrl", () => {
    it("returns redirect_url", () => {
      expect(provider.extractApplyUrl(RAW_JOB as any)).toBe(RAW_JOB.redirect_url);
    });

    it("returns null when redirect_url is missing", () => {
      const { redirect_url, ...rest } = RAW_JOB;
      expect(provider.extractApplyUrl(rest as any)).toBeNull();
    });
  });
});
