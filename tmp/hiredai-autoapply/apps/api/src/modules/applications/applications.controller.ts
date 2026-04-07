import { Controller, Get, Post, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApplicationsService } from "./applications.service";
import { ApplicationQueryDto } from "./dto/application-query.dto";

@ApiTags("applications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  findAll(@Request() req: { user: { id: string } }, @Query() query: ApplicationQueryDto) {
    return this.applicationsService.findAll(req.user.id, query);
  }

  @Get("review")
  getReviewQueue(@Request() req: { user: { id: string } }) {
    return this.applicationsService.getReviewQueue(req.user.id);
  }

  @Get(":id")
  findOne(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.applicationsService.findOne(req.user.id, id);
  }

  @Post(":id/approve")
  approve(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.applicationsService.approve(req.user.id, id);
  }

  @Post(":id/reject")
  reject(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.applicationsService.reject(req.user.id, id);
  }

  @Post(":id/cancel")
  cancel(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.applicationsService.cancel(req.user.id, id);
  }
}
