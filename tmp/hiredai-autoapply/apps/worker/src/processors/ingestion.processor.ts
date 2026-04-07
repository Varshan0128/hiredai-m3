import { Job, Queue } from "bullmq";
import { prisma } from "@hiredai/db";
import { AdzunaProvider } from "../providers/adzuna.provider";
import { JoobleProvider } from "../providers/jooble.provider";
import { createRedisConnection } from "../config/redis";
import { createLogger } from "../config/logger";

const logger = createLogger("IngestionProcessor");

export async function ingestionProcessor(job: Job) {
  const { userId, preferenceId } = job.data as { userId: string; preferenceId: string };
  logger.info(`Starting ingestion for user ${userId}`);

  const pref = await prisma.autoApplyPreference.findUniqueOrThrow({ where: { id: preferenceId } });

  const adzuna = new AdzunaProvider(
    process.env.ADZUNA_APP_ID!,
    process.env.ADZUNA_APP_KEY!,
    process.env.ADZUNA_BASE_URL,
    process.env.ADZUNA_COUNTRY ?? "gb",
  );

  const jooble = new JoobleProvider(
    process.env.JOOBLE_API_KEY!,
    process.env.JOOBLE_BASE_URL,
  );

  const normQueue = new Queue("normalization", { connection: createRedisConnection() });
  let total = 0;

  for (const role of pref.targetRoles) {
    for (const location of [...pref.preferredLocations, ""]) {
      try {
        const [adzunaJobs, joobleJobs] = await Promise.allSettled([
          adzuna.searchJobs({ query: role, location: location || undefined, resultsPerPage: 20 }),
          jooble.searchJobs({ query: role, location: location || undefined }),
        ]);

        const allJobs = [
          ...(adzunaJobs.status === "fulfilled" ? adzunaJobs.value : []),
          ...(joobleJobs.status === "fulfilled" ? joobleJobs.value : []),
        ];

        for (const normalizedJob of allJobs) {
          try {
            const saved = await prisma.job.upsert({
              where: {
                externalId_sourceProvider: {
                  externalId: normalizedJob.externalId,
                  sourceProvider: normalizedJob.sourceProvider,
                },
              },
              update: { updatedAt: new Date() },
              create: {
                externalId: normalizedJob.externalId,
                sourceProvider: normalizedJob.sourceProvider,
                title: normalizedJob.title,
                companyName: normalizedJob.companyName,
                location: normalizedJob.location,
                normalizedLocation: normalizedJob.normalizedLocation,
                description: normalizedJob.description,
                salaryMin: normalizedJob.salaryMin,
                salaryMax: normalizedJob.salaryMax,
                currency: normalizedJob.currency,
                applyUrl: normalizedJob.applyUrl,
                providerJobUrl: normalizedJob.providerJobUrl,
                postedAt: normalizedJob.postedAt,
                workMode: normalizedJob.workMode ?? undefined,
                companyType: normalizedJob.companyType ?? undefined,
                experienceLevel: normalizedJob.experienceLevel ?? undefined,
                skills: normalizedJob.skills,
                rawPayload: normalizedJob.rawPayload as any,
                dedupeKey: normalizedJob.dedupeKey,
                isActive: true,
              },
            });

            await normQueue.add("normalize", { jobId: saved.id, userId });
            total++;
          } catch (err: any) {
            logger.warn(`Failed to upsert job ${normalizedJob.externalId}: ${err.message}`);
          }
        }
      } catch (err: any) {
        logger.warn(`Provider fetch failed for role="${role}" location="${location}": ${err.message}`);
      }
    }
  }

  await normQueue.close();
  logger.info(`Ingestion complete: ${total} jobs queued for normalization`);
  return { total };
}
