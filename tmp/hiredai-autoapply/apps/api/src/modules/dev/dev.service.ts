import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import * as bcrypt from "bcryptjs";

@Injectable()
export class DevService {
  constructor(private readonly prisma: PrismaService) {}

  async seed() {
    if (process.env.NODE_ENV === "production") throw new Error("Seed disabled in production");

    const passwordHash = await bcrypt.hash("password123", 12);
    const user = await this.prisma.user.upsert({
      where: { email: "demo@hiredai.dev" },
      update: {},
      create: { name: "Demo User", email: "demo@hiredai.dev", passwordHash },
    });

    await this.prisma.autoApplyPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        enabled: true,
        fullyAutomatic: false,
        targetRoles: ["Software Engineer", "Frontend Developer", "Full Stack Developer"],
        preferredLocations: ["Remote", "London", "New York"],
        minSalary: 60000,
        maxSalary: 150000,
        workModes: ["remote", "hybrid"],
        companyTypes: ["startup", "product_based"],
        experienceLevels: ["junior", "mid"],
        maxApplicationsPerDay: 10,
        maxApplicationsPerWeek: 40,
        minimumMatchScore: 65,
      },
    });

    return { message: "Seeded successfully", userId: user.id, email: user.email };
  }

  async mockIngest() {
    if (process.env.NODE_ENV === "production") throw new Error("Mock ingest disabled in production");

    const mockJobs = [
      {
        externalId: "adzuna_mock_001",
        sourceProvider: "adzuna" as const,
        title: "Senior Frontend Developer",
        companyName: "TechStartup Ltd",
        location: "London, UK",
        normalizedLocation: "london uk",
        description: "We are looking for an experienced React developer. Skills: React, TypeScript, Node.js, GraphQL, AWS.",
        salaryMin: 80000,
        salaryMax: 110000,
        currency: "GBP",
        applyUrl: "https://adzuna.com/jobs/mock-001",
        providerJobUrl: "https://adzuna.com/jobs/mock-001",
        workMode: "hybrid" as const,
        companyType: "startup" as const,
        experienceLevel: "senior" as const,
        skills: ["react", "typescript", "nodejs", "graphql", "aws"],
        isActive: true,
        rawPayload: {},
        dedupeKey: "senior_frontend_developer__techstartup_ltd__london_uk",
        postedAt: new Date(),
      },
      {
        externalId: "jooble_mock_001",
        sourceProvider: "jooble" as const,
        title: "Full Stack Engineer",
        companyName: "Product Co",
        location: "Remote",
        normalizedLocation: "remote",
        description: "Full stack role with React, Node.js, PostgreSQL, Docker. Remote position. Mid-level experience.",
        salaryMin: 70000,
        salaryMax: 95000,
        currency: "USD",
        applyUrl: "https://jooble.org/jdp/mock-001",
        providerJobUrl: "https://jooble.org/jdp/mock-001",
        workMode: "remote" as const,
        companyType: "product_based" as const,
        experienceLevel: "mid" as const,
        skills: ["react", "nodejs", "postgresql", "docker"],
        isActive: true,
        rawPayload: {},
        dedupeKey: "full_stack_engineer__product_co__remote",
        postedAt: new Date(),
      },
      {
        externalId: "adzuna_mock_002",
        sourceProvider: "adzuna" as const,
        title: "React Developer",
        companyName: "Digital Agency",
        location: "Manchester, UK",
        normalizedLocation: "manchester uk",
        description: "Junior to mid level React developer. HTML, CSS, JavaScript, React, Redux.",
        salaryMin: 40000,
        salaryMax: 55000,
        currency: "GBP",
        applyUrl: "https://adzuna.com/jobs/mock-002",
        providerJobUrl: "https://adzuna.com/jobs/mock-002",
        workMode: "onsite" as const,
        companyType: "service_based" as const,
        experienceLevel: "junior" as const,
        skills: ["react", "javascript", "css", "html"],
        isActive: true,
        rawPayload: {},
        dedupeKey: "react_developer__digital_agency__manchester_uk",
        postedAt: new Date(Date.now() - 2 * 86400000),
      },
    ];

    let created = 0;
    for (const job of mockJobs) {
      await this.prisma.job.upsert({
        where: { externalId_sourceProvider: { externalId: job.externalId, sourceProvider: job.sourceProvider } },
        update: {},
        create: job,
      });
      created++;
    }

    return { message: `Mock ingested ${created} jobs` };
  }
}
