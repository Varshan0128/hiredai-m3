import { Controller, Get, Post, Param, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { JobsService } from "./jobs.service";
import { JobQueryDto } from "./dto/job-query.dto";

@ApiTags("jobs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  findAll(@Request() req: { user: { id: string } }, @Query() query: JobQueryDto) {
    return this.jobsService.findAll(req.user.id, query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.jobsService.findOne(id);
  }

  @Post("ingest/run")
  triggerIngestion(@Request() req: { user: { id: string } }) {
    return this.jobsService.triggerIngestion(req.user.id);
  }

  @Post("match/run")
  triggerMatching(@Request() req: { user: { id: string } }) {
    return this.jobsService.triggerMatching(req.user.id);
  }
}
