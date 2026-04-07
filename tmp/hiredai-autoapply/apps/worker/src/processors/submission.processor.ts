import { Job, Queue } from "bullmq";
import { prisma } from "@hiredai/db";
import { createRedisConnection } from "../config/redis";
import { createLogger } from "../config/logger";

const logger = createLogger("SubmissionProcessor");

export async function submissionProcessor(job: Job) {
  const { applicationId } = job.data as { applicationId: string };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, resume: true },
  });

  if (!app) { logger.warn(`Application ${applicationId} not found`); return; }
  if (!["scheduled", "approved"].includes(app.status)) {
    logger.info(`Skipping submission for app ${applicationId} with status ${app.status}`);
    return;
  }

  await prisma.application.update({ where: { id: applicationId }, data: { status: "submitting" } });
  await prisma.applicationEvent.create({
    data: { applicationId, type: "submitting", message: "Submission started" },
  });

  try {
    const result = await submitApplication(app);

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "submitted",
        appliedAt: new Date(),
        submissionMode: result.mode,
        submittedPayload: result.payload as any,
        externalApplicationId: result.externalId ?? null,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        type: "submitted",
        message: `Successfully submitted via ${result.mode}`,
        metadata: { mode: result.mode, url: app.job.applyUrl },
      },
    });

    // Notify user
    const notifQueue = new Queue("notification", { connection: createRedisConnection() });
    await notifQueue.add("notify", {
      userId: app.userId,
      type: "application_submitted",
      title: "Application submitted",
      body: `Applied to "${app.job.title}" at ${app.job.companyName}`,
      metadata: { applicationId, jobId: app.jobId },
    });
    await notifQueue.close();

    logger.info(`Submitted application ${applicationId} via ${result.mode}`);
  } catch (err: any) {
    const retryCount = (app.retryCount ?? 0) + 1;
    const permanent = retryCount >= 3;

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: permanent ? "failed" : "retrying",
        failureReason: err.message,
        retryCount,
      },
    });

    await prisma.applicationEvent.create({
      data: {
        applicationId,
        type: permanent ? "failed" : "retrying",
        message: `Submission failed (attempt ${retryCount}): ${err.message}`,
        metadata: { error: err.message, retryCount },
      },
    });

    if (!permanent) {
      const retryQueue = new Queue("retry", { connection: createRedisConnection() });
      await retryQueue.add("retry-submit", { applicationId }, {
        delay: Math.pow(2, retryCount) * 60000, // exponential: 2min, 4min, 8min
      });
      await retryQueue.close();
    } else {
      const notifQueue = new Queue("notification", { connection: createRedisConnection() });
      await notifQueue.add("notify", {
        userId: app.userId,
        type: "submission_failed",
        title: "Application failed",
        body: `Could not apply to "${app.job.title}" at ${app.job.companyName}`,
        metadata: { applicationId, reason: err.message },
      });
      await notifQueue.close();
    }

    logger.error(`Submission failed for ${applicationId}: ${err.message}`);
  }
}

interface SubmissionResult {
  mode: "direct_source_apply" | "mocked_structured_submit";
  payload: Record<string, unknown>;
  externalId?: string;
}

async function submitApplication(app: any): Promise<SubmissionResult> {
  const applyUrl = app.job.applyUrl ?? app.job.providerJobUrl;

  if (applyUrl) {
    // Mode 1: direct_source_apply — record the intent and URL
    // In production, this would open the URL in a headless browser
    // or POST to a direct application endpoint if available.
    // For Adzuna/Jooble sourced jobs, we record the apply URL and mark as applied.
    const payload = {
      applyUrl,
      jobTitle: app.job.title,
      company: app.job.companyName,
      resumeUrl: app.resume?.fileUrl ?? null,
      sourceProvider: app.job.sourceProvider,
      appliedAt: new Date().toISOString(),
    };

    // Simulate network call — replace with real HTTP POST/redirect tracking
    await simulateDelay(300);

    return {
      mode: "direct_source_apply",
      payload,
      externalId: `${app.job.sourceProvider}_${app.job.externalId}_${Date.now()}`,
    };
  }

  // Mode 2: mocked_structured_submit — no valid URL
  const payload = {
    mock: true,
    jobId: app.jobId,
    jobTitle: app.job.title,
    company: app.job.companyName,
    resumeUrl: app.resume?.fileUrl ?? null,
    note: "No direct apply URL available; recorded internally",
  };

  await simulateDelay(100);

  return { mode: "mocked_structured_submit", payload };
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
