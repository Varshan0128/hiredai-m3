import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpdateResumeDto } from "./dto/update-resume.dto";
import * as path from "path";
import * as fs from "fs/promises";

@Injectable()
export class ResumesService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(userId: string, file: Express.Multer.File, title: string, roleTag?: string) {
    const isFirst = (await this.prisma.resume.count({ where: { userId } })) === 0;
    return this.prisma.resume.create({
      data: {
        userId,
        title,
        roleTag: roleTag ?? null,
        fileUrl: `/uploads/${file.filename}`,
        isDefault: isFirst,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async findOne(userId: string, id: string) {
    const resume = await this.prisma.resume.findUnique({ where: { id } });
    if (!resume) throw new NotFoundException("Resume not found");
    if (resume.userId !== userId) throw new ForbiddenException();
    return resume;
  }

  async update(userId: string, id: string, dto: UpdateResumeDto) {
    await this.findOne(userId, id);
    if (dto.isDefault) {
      await this.prisma.resume.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.resume.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const resume = await this.findOne(userId, id);
    try {
      await fs.unlink(path.join(process.cwd(), resume.fileUrl));
    } catch { /* file may not exist */ }
    return this.prisma.resume.delete({ where: { id } });
  }
}
