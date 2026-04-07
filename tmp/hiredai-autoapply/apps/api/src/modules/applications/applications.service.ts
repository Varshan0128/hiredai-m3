import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/prisma/prisma.service";
import { QUEUE_NAMES } from "../../common/queue/queue.module";
import { ApplicationQueryDto } from "./dto/application-query.dto";

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.SCHEDULING) private readonly schedulingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SUBMISSION) private readonly submissionQueue: Queue,
  ) {}

  async findAll(userId: string, query: ApplicationQueryDto) {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;
    const where = { userId, ...(status ? { status: status as any } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          job: { select: { id: true, title: true, companyName: true, location: true, sourceProvider: true } },
          resume: { select: { id: true, title: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { data, total, page, limit, hasMore: skip + limit < total };
  }

  async findOne(userId: string, id: string) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: true,
        resume: true,
        events: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!app) throw new NotFoundException("Application not found");
    if (app.userId !== userId) throw new ForbiddenException();
    return app;
  }

  async getReviewQueue(userId: string) {
    return this.prisma.application.findMany({
      where: { userId, status: "needs_review" },
      include: {
        job: true,
        resume: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(userId: string, id: string) {
    const app = await this.findOne(userId, id);
    if (app.status !== "needs_review") throw new ForbiddenException("Application is not pending review");

    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: "approved", requiresReview: false },
    });

    await this.prisma.applicationEvent.create({
      data: { applicationId: id, type: "approved", message: "Manually approved by user" },
    });

    await this.schedulingQueue.add("schedule", { userId, applicationId: id });
    return updated;
  }

  async reject(userId: string, id: string) {
    const app = await this.findOne(userId, id);
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: "rejected" },
    });

    await this.prisma.applicationEvent.create({
      data: { applicationId: id, type: "rejected", message: "Manually rejected by user" },
    });

    return updated;
  }

  async cancel(userId: string, id: string) {
    await this.findOne(userId, id);
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: "cancelled" },
    });

    await this.prisma.applicationEvent.create({
      data: { applicationId: id, type: "cancelled", message: "Cancelled by user" },
    });

    return updated;
  }
}
