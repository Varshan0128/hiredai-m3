import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { ResumesModule } from "./modules/resumes/resumes.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { ApplicationsModule } from "./modules/applications/applications.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { PreferencesModule } from "./modules/preferences/preferences.module";
import { DevModule } from "./modules/dev/dev.module";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { QueueModule } from "./common/queue/queue.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    QueueModule,
    AuthModule,
    ResumesModule,
    JobsModule,
    ApplicationsModule,
    NotificationsModule,
    PreferencesModule,
    DevModule,
    HealthModule,
  ],
})
export class AppModule {}
