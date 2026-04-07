import { Controller, Get, Put, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PreferencesService } from "./preferences.service";
import { UpsertPreferenceDto } from "./dto/upsert-preference.dto";

@ApiTags("preferences")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("auto-apply/preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  get(@Request() req: { user: { id: string } }) {
    return this.preferencesService.get(req.user.id);
  }

  @Put()
  upsert(@Request() req: { user: { id: string } }, @Body() dto: UpsertPreferenceDto) {
    return this.preferencesService.upsert(req.user.id, dto);
  }
}
