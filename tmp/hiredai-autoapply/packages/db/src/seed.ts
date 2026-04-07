import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── User ──────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@hiredai.dev" },
    update: {},
    create: { name: "Demo User", email: "demo@hiredai.dev", passwordHash },
  });
  console.log(`User: ${user.email}`);

  // ── Resumes ───────────────────────────────────────────────────────────────
  const resume1 = await prisma.resume.upsert({
    where: { id: "resume_seed_001" },
    update: {},
    create: {
      id: "resume_seed_001",
      userId: user.id,
      title: "Frontend Developer Resume",
      fileUrl: "/uploads/seed-resume-frontend.pdf",
      roleTag: "frontend developer",
      isDefault: true,
      extractedText: "React TypeScript JavaScript NextJS TailwindCSS NodeJS PostgreSQL Git Docker AWS HTML CSS GraphQL",
    },
  });

  const resume2 = await prisma.resume.upsert({
    where: { id: "resume_seed_002" },
    update: {},
    create: {
      id: "resume_seed_002",
      userId: user.id,
      title: "Full Stack Resume",
      fileUrl: "/uploads/seed-resume-fullstack.pdf",
      roleTag: "full stack engineer",
      isDefault: false,
      extractedText: "React TypeScript NodeJS Express PostgreSQL MongoDB Redis Docker Kubernetes AWS Python FastAPI",
    },
  });

  const resume3 = await prisma.resume.upsert({
    where: { id: "resume_seed_003" },
    update: {},
    create: {
      id: "resume_seed_003",
      userId: user.id,
      title: "Backend Engineer Resume",
      fileUrl: "/uploads/seed-resume-backend.pdf",
      roleTag: "backend engineer",
      isDefault: false,
      extractedText: "Python FastAPI Django PostgreSQL Redis Kafka Docker Kubernetes AWS GCP REST APIs SQL",
    },
  });
  console.log("Resumes: 3 created");

  // ── Preferences ───────────────────────────────────────────────────────────
  await prisma.autoApplyPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      enabled: true,
      fullyAutomatic: false,
      targetRoles: ["Frontend Developer", "Full Stack Engineer", "React Developer", "Software Engineer"],
      preferredLocations: ["Remote", "London", "New York", "Berlin"],
      minSalary: 60000,
      maxSalary: 140000,
      workModes: ["remote", "hybrid"],
      companyTypes: ["startup", "product_based"],
      experienceLevels: ["junior", "mid"],
      maxApplicationsPerDay: 10,
      maxApplicationsPerWeek: 40,
      minimumMatchScore: 60,
    },
  });
  console.log("Preferences: created");

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobsData = [
    // AUTO_APPLY candidates (high score, remote, startup)
    {
      id: "job_seed_001",
      externalId: "adzuna_001",
      sourceProvider: "adzuna" as const,
      title: "Senior React Developer",
      companyName: "CloudStartup Ltd",
      location: "Remote",
      normalizedLocation: "remote",
      description: "Looking for a senior React developer with TypeScript and Node.js experience. Fully remote position. Junior to mid level welcome.",
      salaryMin: 80000, salaryMax: 110000, currency: "GBP",
      applyUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_001",
      providerJobUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_001",
      workMode: "remote" as const, companyType: "startup" as const,
      experienceLevel: "mid" as const, skills: ["react", "typescript", "nodejs"],
      dedupeKey: "senior_react_developer__cloudstartup_ltd__remote",
      postedAt: new Date(Date.now() - 1 * 86400000),
    },
    {
      id: "job_seed_002",
      externalId: "jooble_001",
      sourceProvider: "jooble" as const,
      title: "Full Stack Engineer",
      companyName: "ProductCo",
      location: "Remote",
      normalizedLocation: "remote",
      description: "Full stack engineer with React, NodeJS, and PostgreSQL. Startup environment, fully remote, mid-level.",
      salaryMin: 75000, salaryMax: 95000, currency: "USD",
      applyUrl: "https://jooble.org/jdp/jooble_001",
      providerJobUrl: "https://jooble.org/jdp/jooble_001",
      workMode: "remote" as const, companyType: "product_based" as const,
      experienceLevel: "mid" as const, skills: ["react", "nodejs", "postgresql"],
      dedupeKey: "full_stack_engineer__productco__remote",
      postedAt: new Date(Date.now() - 2 * 86400000),
    },
    // NEEDS_REVIEW candidates (good score but missing fields)
    {
      id: "job_seed_003",
      externalId: "adzuna_002",
      sourceProvider: "adzuna" as const,
      title: "Frontend Developer",
      companyName: "TechAgency",
      location: "London, UK",
      normalizedLocation: "london uk",
      description: "Frontend developer with React skills. JavaScript and TypeScript. Salary negotiable. Office based.",
      salaryMin: null, salaryMax: null, currency: "GBP",
      applyUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_002",
      providerJobUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_002",
      workMode: null, companyType: null,
      experienceLevel: "junior" as const, skills: ["react", "javascript", "typescript"],
      dedupeKey: "frontend_developer__techagency__london_uk",
      postedAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      id: "job_seed_004",
      externalId: "jooble_002",
      sourceProvider: "jooble" as const,
      title: "React Developer",
      companyName: "Digital Solutions Inc",
      location: "New York, NY",
      normalizedLocation: "new york ny",
      description: "React developer needed. Hybrid work model. TypeScript, GraphQL experience preferred.",
      salaryMin: 90000, salaryMax: 120000, currency: "USD",
      applyUrl: "https://jooble.org/jdp/jooble_002",
      providerJobUrl: "https://jooble.org/jdp/jooble_002",
      workMode: "hybrid" as const, companyType: null,
      experienceLevel: "mid" as const, skills: ["react", "typescript", "graphql"],
      dedupeKey: "react_developer__digital_solutions_inc__new_york_ny",
      postedAt: new Date(Date.now() - 1 * 86400000),
    },
    // SKIP candidates (role mismatch, low salary, expired)
    {
      id: "job_seed_005",
      externalId: "adzuna_003",
      sourceProvider: "adzuna" as const,
      title: "Java Backend Engineer",
      companyName: "Enterprise Corp",
      location: "Manchester, UK",
      normalizedLocation: "manchester uk",
      description: "Java Spring Boot backend engineer. Enterprise financial services. Onsite only.",
      salaryMin: 55000, salaryMax: 70000, currency: "GBP",
      applyUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_003",
      providerJobUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_003",
      workMode: "onsite" as const, companyType: "mnc" as const,
      experienceLevel: "senior" as const, skills: ["java", "spring", "sql"],
      dedupeKey: "java_backend_engineer__enterprise_corp__manchester_uk",
      postedAt: new Date(Date.now() - 15 * 86400000),
    },
    // DUPLICATE example (same job, different source — dedup should catch this)
    {
      id: "job_seed_006",
      externalId: "jooble_003",
      sourceProvider: "jooble" as const,
      title: "Senior React Developer",
      companyName: "CloudStartup Ltd",
      location: "Remote",
      normalizedLocation: "remote",
      description: "Duplicate of job_seed_001 from Jooble. Same role, same company.",
      salaryMin: 80000, salaryMax: 110000, currency: "USD",
      applyUrl: "https://jooble.org/jdp/jooble_003",
      providerJobUrl: "https://jooble.org/jdp/jooble_003",
      workMode: "remote" as const, companyType: "startup" as const,
      experienceLevel: "mid" as const, skills: ["react", "typescript"],
      dedupeKey: "senior_react_developer__cloudstartup_ltd__remote", // Same key as job_seed_001
      postedAt: new Date(Date.now() - 1 * 86400000),
      isActive: false, // Already deduped
    },
    // More variety
    {
      id: "job_seed_007",
      externalId: "adzuna_004",
      sourceProvider: "adzuna" as const,
      title: "Software Engineer",
      companyName: "GrowthStartup",
      location: "Berlin, Germany",
      normalizedLocation: "berlin germany",
      description: "Software engineer at fast-growing startup. React, TypeScript, Node.js, PostgreSQL. Remote-first culture.",
      salaryMin: 70000, salaryMax: 100000, currency: "EUR",
      applyUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_004",
      providerJobUrl: "https://www.adzuna.co.uk/jobs/details/adzuna_004",
      workMode: "remote" as const, companyType: "startup" as const,
      experienceLevel: "mid" as const, skills: ["react", "typescript", "nodejs", "postgresql"],
      dedupeKey: "software_engineer__growthstartup__berlin_germany",
      postedAt: new Date(Date.now() - 4 * 86400000),
    },
    {
      id: "job_seed_008",
      externalId: "jooble_004",
      sourceProvider: "jooble" as const,
      title: "Frontend Engineer",
      companyName: "SaaSCo",
      location: "Remote",
      normalizedLocation: "remote",
      description: "Frontend engineer for SaaS product. NextJS, React, TypeScript, TailwindCSS. Junior to mid.",
      salaryMin: 65000, salaryMax: 85000, currency: "USD",
      applyUrl: "https://jooble.org/jdp/jooble_004",
      providerJobUrl: "https://jooble.org/jdp/jooble_004",
      workMode: "remote" as const, companyType: "product_based" as const,
      experienceLevel: "junior" as const, skills: ["nextjs", "react", "typescript", "tailwind"],
      dedupeKey: "frontend_engineer__saasco__remote",
      postedAt: new Date(Date.now() - 2 * 86400000),
    },
  ];

  for (const job of jobsData) {
    await prisma.job.upsert({
      where: { id: job.id },
      update: {},
      create: { ...job, rawPayload: {} },
    });
  }
  console.log(`Jobs: ${jobsData.length} seeded`);

  // ── Match Results ─────────────────────────────────────────────────────────
  const matchData = [
    { jobId: "job_seed_001", resumeId: resume1.id, score: 88, decision: "auto_apply" as const, reason: "Strong React/TypeScript match, remote preferred, startup preferred" },
    { jobId: "job_seed_002", resumeId: resume2.id, score: 82, decision: "needs_review" as const, reason: "Good full stack match, semi-automatic mode" },
    { jobId: "job_seed_003", resumeId: resume1.id, score: 70, decision: "needs_review" as const, reason: "Missing salary and work mode data" },
    { jobId: "job_seed_004", resumeId: resume1.id, score: 75, decision: "needs_review" as const, reason: "Company type unknown" },
    { jobId: "job_seed_005", resumeId: resume3.id, score: 28, decision: "skip" as const, reason: "Role mismatch (Java), work mode mismatch (onsite)" },
    { jobId: "job_seed_007", resumeId: resume2.id, score: 85, decision: "needs_review" as const, reason: "Good match, semi-automatic mode" },
    { jobId: "job_seed_008", resumeId: resume1.id, score: 90, decision: "needs_review" as const, reason: "Excellent NextJS/React match, semi-automatic mode" },
  ];

  for (const m of matchData) {
    await prisma.matchResult.upsert({
      where: { userId_jobId: { userId: user.id, jobId: m.jobId } },
      update: {},
      create: {
        userId: user.id, jobId: m.jobId, resumeId: m.resumeId,
        matchScore: m.score, decision: m.decision,
        roleFitScore: m.score * 0.9, skillFitScore: m.score * 0.85,
        locationFitScore: 80, salaryFitScore: 70, workModeFitScore: 90,
        experienceFitScore: 75, companyTypeFitScore: 80,
        explanation: {
          decisionReason: m.reason, matchedSkills: ["react", "typescript"],
          missingSkills: [], locationReason: "Matches remote preference",
          salaryReason: "Within range", companyReason: "Startup preferred",
          workModeReason: "Remote preferred",
          roleFitScore: m.score * 0.9, skillFitScore: m.score * 0.85,
          locationFitScore: 80, salaryFitScore: 70, workModeFitScore: 90,
          experienceFitScore: 75, companyTypeFitScore: 80,
        },
      },
    });
  }
  console.log(`Match results: ${matchData.length} seeded`);

  // ── Applications ──────────────────────────────────────────────────────────
  const appData = [
    { id: "app_seed_001", jobId: "job_seed_001", resumeId: resume1.id, status: "submitted" as const, requiresReview: false, mode: "direct_source_apply" as const },
    { id: "app_seed_002", jobId: "job_seed_002", resumeId: resume2.id, status: "needs_review" as const, requiresReview: true, mode: undefined },
    { id: "app_seed_003", jobId: "job_seed_003", resumeId: resume1.id, status: "needs_review" as const, requiresReview: true, mode: undefined },
    { id: "app_seed_004", jobId: "job_seed_004", resumeId: resume1.id, status: "scheduled" as const, requiresReview: false, mode: undefined },
    { id: "app_seed_005", jobId: "job_seed_005", resumeId: resume3.id, status: "skipped" as const, requiresReview: false, mode: undefined },
    { id: "app_seed_006", jobId: "job_seed_007", resumeId: resume2.id, status: "failed" as const, requiresReview: false, mode: "direct_source_apply" as const },
    { id: "app_seed_007", jobId: "job_seed_008", resumeId: resume1.id, status: "needs_review" as const, requiresReview: true, mode: undefined },
  ];

  for (const a of appData) {
    await prisma.application.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id, userId: user.id, jobId: a.jobId, resumeId: a.resumeId,
        status: a.status, sourceProvider: a.jobId.includes("adzuna") ? "adzuna" : "jooble",
        requiresReview: a.requiresReview,
        submissionMode: a.mode,
        appliedAt: a.status === "submitted" ? new Date(Date.now() - 3600000) : null,
        scheduledAt: a.status === "scheduled" ? new Date(Date.now() + 7200000) : null,
        failureReason: a.status === "failed" ? "Connection timeout to provider" : null,
      },
    });

    await prisma.applicationEvent.createMany({
      skipDuplicates: true,
      data: [
        { applicationId: a.id, type: "created", message: "Application created" },
        ...(a.status === "submitted" ? [
          { applicationId: a.id, type: "approved" as const, message: "Auto-approved by AI engine" },
          { applicationId: a.id, type: "scheduled" as const, message: "Scheduled for submission" },
          { applicationId: a.id, type: "submitted" as const, message: "Successfully submitted via direct_source_apply" },
        ] : []),
        ...(a.status === "failed" ? [
          { applicationId: a.id, type: "failed" as const, message: "Submission failed: Connection timeout" },
        ] : []),
      ],
    });
  }
  console.log(`Applications: ${appData.length} seeded`);

  // ── Notifications ─────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      { userId: user.id, type: "application_submitted", title: "Application submitted", body: 'Applied to "Senior React Developer" at CloudStartup Ltd', read: false },
      { userId: user.id, type: "jobs_need_review", title: "3 jobs need your review", body: "Review and approve pending job applications", read: false },
      { userId: user.id, type: "submission_failed", title: "Application failed", body: 'Could not apply to "Software Engineer" at GrowthStartup', read: true },
    ],
  });
  console.log("Notifications: 3 seeded");

  console.log("\nSeed complete!");
  console.log("Login: demo@hiredai.dev / password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
