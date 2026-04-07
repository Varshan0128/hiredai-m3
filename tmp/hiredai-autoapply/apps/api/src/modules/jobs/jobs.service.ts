import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import { QUEUE_NAMES } from "../../common/queue/queue.module";
import { JobQueryDto } from "./dto/job-query.dto";

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.INGESTION) private readonly ingestionQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MATCH) private readonly matchQueue: Queue,
  ) {}

  async findAll(userId: string, query: JobQueryDto) {
    const { page = 1, limit = 20, status, source, decision } = query;
    const skip = (page - 1) * limit;

    if (decision) {
      const [data, total] = await Promise.all([
        this.prisma.matchResult.findMany({
          where: { userId, decision },
          include: { job: true, resume: { select: { id: true, title: true } } },
          orderBy: [{ matchScore: "desc" }],
          skip,
          take: limit,
        }),
        this.prisma.matchResult.count({ where: { userId, decision } }),
      ]);
      return { data, total, page, limit, hasMore: skip + limit < total };
    }

    const where = {
      isActive: true,
      ...(source ? { sourceProvider: source as "adzuna" | "jooble" } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { postedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    return { data, total, page, limit, hasMore: skip + limit < total };
  }

  findOne(id: string) {
    return this.prisma.job.findUniqueOrThrow({ where: { id } });
  }

  async triggerIngestion(userId: string) {
    const pref = await this.prisma.autoApplyPreference.findUnique({ where: { userId } });
    if (!pref) return { message: "No preferences configured" };

    await this.ingestionQueue.add("ingest", { userId, preferenceId: pref.id });
    return { message: "Ingestion job queued", preferenceId: pref.id };
  }

  async triggerMatching(userId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { isActive: true },
      select: { id: true },
      take: 100,
    });

    for (const job of jobs) {
      await this.matchQueue.add("match", { userId, jobId: job.id });
    }

    return { message: `Matching queued for ${jobs.length} jobs` };
  }
}
