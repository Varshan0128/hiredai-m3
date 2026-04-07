import { Worker } from "bullmq";
import { createRedisConnection } from "./config/redis";
import { createLogger } from "./config/logger";
import { ingestionProcessor } from "./processors/ingestion.processor";
import { normalizationProcessor } from "./processors/normalization.processor";
import { deduplicationProcessor } from "./processors/deduplication.processor";
import { matchProcessor } from "./processors/match.processor";
import { schedulingProcessor } from "./processors/scheduling.processor";
import { submissionProcessor } from "./processors/submission.processor";
import { notificationProcessor } from "./processors/notification.processor";

const QUEUE_NAMES = {
  INGESTION: "ingestion",
  NORMALIZATION: "normalization",
  DEDUPLICATION: "deduplication",
  MATCH: "match",
  SCHEDULING: "scheduling",
  SUBMISSION: "submission",
  RETRY: "retry",
  NOTIFICATION: "notification",
} as const;

const logger = createLogger("WorkerFactory");

export async function createWorkers(): Promise<Worker[]> {
  const connection = createRedisConnection();
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "5");

  const workerConfigs = [
    { name: QUEUE_NAMES.INGESTION,      processor: ingestionProcessor },
    { name: QUEUE_NAMES.NORMALIZATION,  processor: normalizationProcessor },
    { name: QUEUE_NAMES.DEDUPLICATION,  processor: deduplicationProcessor },
    { name: QUEUE_NAMES.MATCH,          processor: matchProcessor },
    { name: QUEUE_NAMES.SCHEDULING,     processor: schedulingProcessor },
    { name: QUEUE_NAMES.SUBMISSION,     processor: submissionProcessor },
    { name: QUEUE_NAMES.NOTIFICATION,   processor: notificationProcessor },
  ];

  const workers = workerConfigs.map(({ name, processor }) => {
    const worker = new Worker(name, processor, {
      connection,
      concurrency,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });

    worker.on("completed", (job) => logger.info(`[${name}] Job ${job.id} completed`));
    worker.on("failed", (job, err) => logger.error(`[${name}] Job ${job?.id} failed: ${err.message}`));
    worker.on("error", (err) => logger.error(`[${name}] Worker error: ${err.message}`));

    logger.info(`Worker ready: ${name}`);
    return worker;
  });

  return workers;
}
