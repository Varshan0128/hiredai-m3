import { Job, Queue } from "bullmq";
import { prisma } from "@hiredai/db";
import { scoreJob } from "../scoring/scoring.engine";
import { createRedisConnection } from "../config/redis";
import { createLogger } from "../config/logger";
import type { WorkMode, CompanyType, ExperienceLevel } from "@hiredai/types";

const logger = createLogger("MatchProcessor");

export async function matchProcessor(job: Job) {
  const { jobId, userId } = job.data as { jobId: string; userId: string };

  const [dbJob, pref, alreadyApplied] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.autoApplyPreference.findUnique({ where: { userId } }),
    prisma.application.findFirst({ where: { userId, jobId } }),
  ]);

  if (!dbJob || !pref) {
    logger.warn(`Missing job or preferences for match: jobId=${jobId} userId=${userId}`);
    return;
  }

  if (!dbJob.isActive) return;

  // Select best resume
  let resume = await prisma.resume.findFirst({
    where: { userId, roleTag: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  if (!resume) {
    resume = await prisma.resume.findFirst({ where: { userId, isDefault: true } });
  }

  const resumeSkills: string[] = resume?.extractedText
    ? extractBasicSkills(resume.extractedText)
    : [];

  // Count today/week applications
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());

  const [applicationsToday, applicationsThisWeek] = await Promise.all([
    prisma.application.count({
      where: { userId, createdAt: { gte: startOfDay }, status: { notIn: ["cancelled", "rejected", "skipped"] } },
    }),
    prisma.application.count({
      where: { userId, createdAt: { gte: startOfWeek }, status: { notIn: ["cancelled", "rejected", "skipped"] } },
    }),
  ]);

  const result = scoreJob({
    preference: {
      targetRoles: pref.targetRoles,
      preferredLocations: pref.preferredLocations,
      minSalary: pref.minSalary,
      maxSalary: pref.maxSalary,
      workModes: pref.workModes as WorkMode[],
      companyTypes: pref.companyTypes as CompanyType[],
      experienceLevels: pref.experienceLevels as ExperienceLevel[],
      minimumMatchScore: pref.minimumMatchScore,
      fullyAutomatic: pref.fullyAutomatic,
      maxApplicationsPerDay: pref.maxApplicationsPerDay,
      maxApplicationsPerWeek: pref.maxApplicationsPerWeek,
      postingDateFrom: pref.postingDateFrom,
      postingDateTo: pref.postingDateTo,
    },
    job: {
      id: dbJob.id,
      title: dbJob.title,
      description: dbJob.description,
      location: dbJob.location,
      normalizedLocation: dbJob.normalizedLocation,
      salaryMin: dbJob.salaryMin,
      salaryMax: dbJob.salaryMax,
      workMode: dbJob.workMode as WorkMode | null,
      companyType: dbJob.companyType as CompanyType | null,
      experienceLevel: dbJob.experienceLevel as ExperienceLevel | null,
      skills: dbJob.skills,
      postedAt: dbJob.postedAt,
      expiresAt: dbJob.expiresAt,
      isActive: dbJob.isActive,
      applyUrl: dbJob.applyUrl,
      sourceProvider: dbJob.sourceProvider,
    },
    resumeSkills,
    resumeRoleTag: resume?.roleTag ?? null,
    resumeId: resume?.id ?? null,
    alreadyApplied: !!alreadyApplied,
    applicationsToday,
    applicationsThisWeek,
  });

  // Upsert match result
  await prisma.matchResult.upsert({
    where: { userId_jobId: { userId, jobId } },
    update: {
      matchScore: result.matchScore,
      decision: result.decision,
      explanation: result.explanation as any,
      resumeId: result.resumeId,
      roleFitScore: result.explanation.roleFitScore,
      locationFitScore: result.explanation.locationFitScore,
      salaryFitScore: result.explanation.salaryFitScore,
      skillFitScore: result.explanation.skillFitScore,
      experienceFitScore: result.explanation.experienceFitScore,
      companyTypeFitScore: result.explanation.companyTypeFitScore,
      workModeFitScore: result.explanation.workModeFitScore,
    },
    create: {
      userId, jobId,
      resumeId: result.resumeId,
      matchScore: result.matchScore,
      decision: result.decision,
      explanation: result.explanation as any,
      roleFitScore: result.explanation.roleFitScore,
      locationFitScore: result.explanation.locationFitScore,
      salaryFitScore: result.explanation.salaryFitScore,
      skillFitScore: result.explanation.skillFitScore,
      experienceFitScore: result.explanation.experienceFitScore,
      companyTypeFitScore: result.explanation.companyTypeFitScore,
      workModeFitScore: result.explanation.workModeFitScore,
    },
  });

  if (result.decision === "skip") {
    await createApplication(userId, jobId, resume?.id ?? null, "skipped", dbJob.sourceProvider as any, false);
    logger.info(`Skipped job ${jobId}: ${result.explanation.decisionReason}`);
    return;
  }

  if (result.decision === "needs_review") {
    await createApplication(userId, jobId, resume?.id ?? null, "needs_review", dbJob.sourceProvider as any, true);
    const notifQueue = new Queue("notification", { connection: createRedisConnection() });
    await notifQueue.add("notify", {
      userId,
      type: "jobs_need_review",
      title: "Job needs your review",
      body: `"${dbJob.title}" at ${dbJob.companyName} needs your approval (score: ${result.matchScore})`,
      metadata: { jobId, matchScore: result.matchScore },
    });
    await notifQueue.close();
    return;
  }

  if (result.decision === "auto_apply") {
    const app = await createApplication(userId, jobId, resume?.id ?? null, "approved", dbJob.sourceProvider as any, false);
    const schedulingQueue = new Queue("scheduling", { connection: createRedisConnection() });
    await schedulingQueue.add("schedule", { userId, applicationId: app.id });
    await schedulingQueue.close();
  }
}

async function createApplication(
  userId: string, jobId: string, resumeId: string | null,
  status: string, sourceProvider: "adzuna" | "jooble", requiresReview: boolean,
) {
  const existing = await prisma.application.findUnique({ where: { userId_jobId: { userId, jobId } } });
  if (existing) return existing;

  const app = await prisma.application.create({
    data: { userId, jobId, resumeId, status: status as any, sourceProvider, requiresReview },
  });

  await prisma.applicationEvent.create({
    data: { applicationId: app.id, type: "created", message: `Application created with status: ${status}` },
  });

  return app;
}

function extractBasicSkills(text: string): string[] {
  const skills = [
    "javascript", "typescript", "python", "java", "react", "nextjs", "nodejs",
    "express", "fastapi", "django", "postgresql", "mysql", "mongodb", "redis",
    "aws", "gcp", "azure", "docker", "kubernetes", "graphql", "tailwind", "css", "html", "sql",
  ];
  const lower = text.toLowerCase();
  return skills.filter((s) => lower.includes(s));
}
