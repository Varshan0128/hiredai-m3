import { Job, Queue } from "bullmq";
import { prisma } from "@hiredai/db";
import { createRedisConnection } from "../config/redis";
import { createLogger } from "../config/logger";

const logger = createLogger("DeduplicationProcessor");

export async function deduplicationProcessor(job: Job) {
  const { jobId, userId } = job.data as { jobId: string; userId: string };

  const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
  if (!dbJob) return;

  if (dbJob.dedupeKey) {
    // Find any other job with same dedupeKey from a different provider
    const duplicate = await prisma.job.findFirst({
      where: {
        dedupeKey: dbJob.dedupeKey,
        id: { not: jobId },
        sourceProvider: { not: dbJob.sourceProvider },
      },
      orderBy: { createdAt: "asc" },
    });

    if (duplicate) {
      // Keep the older one (first ingested), mark the newer as inactive
      const keepId = duplicate.createdAt < dbJob.createdAt ? duplicate.id : jobId;
      const dropId = keepId === jobId ? duplicate.id : jobId;

      await prisma.job.update({ where: { id: dropId }, data: { isActive: false } });
      logger.info(`Dedup: kept ${keepId}, deactivated ${dropId} (key: ${dbJob.dedupeKey})`);

      // Only queue match for the kept job
      if (dropId === jobId) return;
    }
  }

  const matchQueue = new Queue("match", { connection: createRedisConnection() });
  await matchQueue.add("match", { jobId, userId });
  await matchQueue.close();
}
