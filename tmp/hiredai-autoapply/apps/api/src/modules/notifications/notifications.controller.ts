import { Controller, Get, Post, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req: { user: { id: string } }) {
    return this.notificationsService.findAll(req.user.id);
  }

  @Get("unread/count")
  unreadCount(@Request() req: { user: { id: string } }) {
    return this.notificationsService.unreadCount(req.user.id);
  }

  @Post(":id/read")
  markRead(@Request() req: { user: { id: string } }, @Param("id") id: string) {
    return this.notificationsService.markRead(req.user.id, id);
  }

  @Post("read-all")
  markAllRead(@Request() req: { user: { id: string } }) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
