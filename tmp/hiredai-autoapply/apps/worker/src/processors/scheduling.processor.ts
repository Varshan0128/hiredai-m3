import { Job, Queue } from "bullmq";
import { prisma } from "@hiredai/db";
import { createRedisConnection } from "../config/redis";
import { createLogger } from "../config/logger";

const logger = createLogger("SchedulingProcessor");

export async function schedulingProcessor(job: Job) {
  const { userId, applicationId } = job.data as { userId: string; applicationId: string };

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });

  if (!app || !["approved"].includes(app.status)) return;

  const pref = await prisma.autoApplyPreference.findUnique({ where: { userId } });
  if (!pref) return;

  // Count how many are already scheduled today
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);

  const scheduledToday = await prisma.application.count({
    where: {
      userId,
      status: { in: ["scheduled", "submitting", "submitted"] },
      scheduledAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  if (scheduledToday >= pref.maxApplicationsPerDay) {
    // Push to next available day
    const nextSlot = getNextAvailableSlot(startOfDay, 1);
    await scheduleAt(app.id, nextSlot);
    logger.info(`Daily limit reached. Rescheduled app ${app.id} to ${nextSlot.toISOString()}`);
    return;
  }

  // Spread submissions across the day in business hours (9am–6pm)
  const slot = computeNextSlot(startOfDay, scheduledToday);
  await scheduleAt(app.id, slot);

  // Queue for submission at the right time
  const delay = Math.max(0, slot.getTime() - Date.now());
  const submissionQueue = new Queue("submission", { connection: createRedisConnection() });
  await submissionQueue.add("submit", { applicationId: app.id }, { delay });
  await submissionQueue.close();

  logger.info(`Scheduled application ${app.id} at ${slot.toISOString()} (delay: ${delay}ms)`);
}

async function scheduleAt(applicationId: string, at: Date) {
  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "scheduled", scheduledAt: at },
  });

  await prisma.applicationEvent.create({
    data: {
      applicationId,
      type: "scheduled",
      message: `Scheduled for submission at ${at.toISOString()}`,
      metadata: { scheduledAt: at.toISOString() },
    },
  });
}

function computeNextSlot(dayStart: Date, slotIndex: number): Date {
  const start = new Date(dayStart);
  start.setHours(9, 0, 0, 0); // 9am
  const minutesPerSlot = 30;
  start.setMinutes(start.getMinutes() + slotIndex * minutesPerSlot);
  // Cap at 6pm
  const end = new Date(dayStart);
  end.setHours(18, 0, 0, 0);
  return start > end ? end : start;
}

function getNextAvailableSlot(from: Date, daysAhead: number): Date {
  const next = new Date(from);
  next.setDate(next.getDate() + daysAhead);
  next.setHours(9, 0, 0, 0);
  return next;
}
