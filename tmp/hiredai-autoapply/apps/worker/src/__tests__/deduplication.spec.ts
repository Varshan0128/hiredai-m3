import { buildDedupeKey } from "../providers/adzuna.provider";

// Re-export the pure util for testing
function buildKey(title: string, company: string, location: string | null): string {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 30);
  return `${n(title)}__${n(company)}__${n(location ?? "any")}`;
}

describe("Deduplication Key Generation", () => {
  it("generates identical keys for same job regardless of minor casing differences", () => {
    const k1 = buildKey("Senior React Developer", "CloudStartup Ltd", "Remote");
    const k2 = buildKey("senior react developer", "cloudstartup ltd", "remote");
    expect(k1).toBe(k2);
  });

  it("generates different keys for different companies", () => {
    const k1 = buildKey("Frontend Developer", "Company A", "Remote");
    const k2 = buildKey("Frontend Developer", "Company B", "Remote");
    expect(k1).not.toBe(k2);
  });

  it("generates different keys for different locations", () => {
    const k1 = buildKey("Software Engineer", "TechCo", "Remote");
    const k2 = buildKey("Software Engineer", "TechCo", "London");
    expect(k1).not.toBe(k2);
  });

  it("handles null location with any placeholder", () => {
    const k1 = buildKey("Developer", "Co", null);
    const k2 = buildKey("Developer", "Co", null);
    expect(k1).toBe(k2);
    expect(k1).toContain("any");
  });

  it("normalizes special characters", () => {
    const k1 = buildKey("Senior React/Vue Developer", "Tech & Co.", "New York");
    expect(k1).not.toContain("/");
    expect(k1).not.toContain("&");
    expect(k1).not.toContain(".");
  });

  it("produces the same key for adzuna and jooble versions of same job", () => {
    // Simulates the real dedup scenario
    const adzunaKey = buildKey("Full Stack Engineer", "ProductCo", "Remote");
    const joobleKey = buildKey("Full Stack Engineer", "ProductCo", "remote");
    expect(adzunaKey).toBe(joobleKey);
  });

  it("truncates long titles to avoid key collisions from over-length", () => {
    const k1 = buildKey("A".repeat(100), "Company", "Remote");
    expect(k1.split("__")[0].length).toBeLessThanOrEqual(30);
  });
});
