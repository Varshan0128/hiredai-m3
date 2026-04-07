import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { UpsertPreferenceDto } from "./dto/upsert-preference.dto";

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.autoApplyPreference.findUnique({ where: { userId } });
  }

  async upsert(userId: string, dto: UpsertPreferenceDto) {
    return this.prisma.autoApplyPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
    });
  }
}
