import { createLogger as winstonLogger, format, transports } from "winston";

export function createLogger(service: string) {
  return winstonLogger({
    defaultMeta: { service },
    format: format.combine(
      format.timestamp(),
      format.colorize(),
      format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
      }),
    ),
    transports: [new transports.Console()],
    level: process.env.LOG_LEVEL ?? "info",
  });
}
