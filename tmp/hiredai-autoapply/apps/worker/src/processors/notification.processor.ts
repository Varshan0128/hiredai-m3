import { Job } from "bullmq";
import { prisma } from "@hiredai/db";
import { createLogger } from "../config/logger";

const logger = createLogger("NotificationProcessor");

export async function notificationProcessor(job: Job) {
  const { userId, type, title, body, metadata } = job.data as {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  };

  await prisma.notification.create({
    data: { userId, type: type as any, title, body, metadata: metadata as any },
  });

  logger.info(`Notification created for user ${userId}: ${type}`);
}
