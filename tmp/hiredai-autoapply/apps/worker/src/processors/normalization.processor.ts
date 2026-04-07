import { Job, Queue } from "bullmq";
import { prisma } from "@hiredai/db";
import { createRedisConnection } from "../config/redis";
import { createLogger } from "../config/logger";

const logger = createLogger("NormalizationProcessor");

export async function normalizationProcessor(job: Job) {
  const { jobId, userId } = job.data as { jobId: string; userId: string };

  const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
  if (!dbJob) { logger.warn(`Job ${jobId} not found`); return; }

  // Normalization is done at ingest time via provider adapters.
  // This step handles post-save enrichment: deduplication queue dispatch.
  const dedupeQueue = new Queue("deduplication", { connection: createRedisConnection() });
  await dedupeQueue.add("dedupe", { jobId, userId });
  await dedupeQueue.close();

  logger.info(`Normalization passed for job ${jobId}, queued for deduplication`);
}
