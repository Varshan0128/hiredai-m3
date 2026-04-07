import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

export const QUEUE_NAMES = {
  INGESTION: "ingestion",
  NORMALIZATION: "normalization",
  DEDUPLICATION: "deduplication",
  MATCH: "match",
  SCHEDULING: "scheduling",
  SUBMISSION: "submission",
  RETRY: "retry",
  NOTIFICATION: "notification",
} as const;

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
          password: config.get("REDIS_PASSWORD") || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INGESTION },
      { name: QUEUE_NAMES.NORMALIZATION },
      { name: QUEUE_NAMES.DEDUPLICATION },
      { name: QUEUE_NAMES.MATCH },
      { name: QUEUE_NAMES.SCHEDULING },
      { name: QUEUE_NAMES.SUBMISSION },
      { name: QUEUE_NAMES.RETRY },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
