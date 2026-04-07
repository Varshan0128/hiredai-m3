import { JoobleProvider } from "../providers/jooble.provider";

const provider = new JoobleProvider("test-key");

const RAW_JOB = {
  id: "jooble_abc123",
  title: "Full Stack Engineer",
  company: "ProductCo",
  location: "Remote",
  snippet: "Full stack engineer with React, NodeJS, and PostgreSQL. Hybrid or remote. Mid-level experience required.",
  salary: "$75,000 - $95,000",
  type: "Full-time",
  link: "https://jooble.org/jdp/jooble_abc123",
  updated: "2024-06-10T10:00:00Z",
  source: "company_site",
};

describe("JoobleProvider", () => {
  it("returns correct source name", () => {
    expect(provider.getSourceName()).toBe("jooble");
  });

  describe("normalizeJob", () => {
    let normalized: ReturnType<typeof provider.normalizeJob>;

    beforeEach(() => {
      normalized = provider.normalizeJob(RAW_JOB as any);
    });

    it("maps externalId", () => {
      expect(normalized.externalId).toBe("jooble_abc123");
    });

    it("sets sourceProvider to jooble", () => {
      expect(normalized.sourceProvider).toBe("jooble");
    });

    it("maps title", () => {
      expect(normalized.title).toBe("Full Stack Engineer");
    });

    it("maps company name", () => {
      expect(normalized.companyName).toBe("ProductCo");
    });

    it("maps location", () => {
      expect(normalized.location).toBe("Remote");
    });

    it("normalizes location to lowercase", () => {
      expect(normalized.normalizedLocation).toBe("remote");
    });

    it("parses salary range", () => {
      expect(normalized.salaryMin).toBe(75000);
      expect(normalized.salaryMax).toBe(95000);
    });

    it("maps apply URL from link field", () => {
      expect(normalized.applyUrl).toBe("https://jooble.org/jdp/jooble_abc123");
    });

    it("maps postedAt from updated field", () => {
      expect(normalized.postedAt).toBeInstanceOf(Date);
    });

    it("infers remote work mode", () => {
      expect(normalized.workMode).toBe("remote");
    });

    it("extracts skills from snippet", () => {
      expect(normalized.skills).toContain("react");
      expect(normalized.skills).toContain("nodejs");
      expect(normalized.skills).toContain("postgresql");
    });

    it("generates dedupeKey", () => {
      expect(normalized.dedupeKey).toBeTruthy();
    });

    it("falls back to generated id when id field is missing", () => {
      const { id, ...rest } = RAW_JOB;
      const result = provider.normalizeJob(rest as any);
      expect(result.externalId).toBeTruthy();
      expect(typeof result.externalId).toBe("string");
    });

    it("handles missing salary gracefully", () => {
      const result = provider.normalizeJob({ ...RAW_JOB, salary: "" } as any);
      expect(result.salaryMin).toBeNull();
      expect(result.salaryMax).toBeNull();
    });
  });

  describe("extractApplyUrl", () => {
    it("returns link field as apply URL", () => {
      expect(provider.extractApplyUrl(RAW_JOB as any)).toBe(RAW_JOB.link);
    });

    it("returns null when link is missing", () => {
      const { link, ...rest } = RAW_JOB;
      expect(provider.extractApplyUrl(rest as any)).toBeNull();
    });
  });
});
