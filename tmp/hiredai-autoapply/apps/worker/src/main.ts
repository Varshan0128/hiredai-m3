import "dotenv/config";
import { createWorkers } from "./worker.factory";
import { createLogger } from "./config/logger";

const logger = createLogger("Main");

async function main() {
  logger.info("Starting HiredAI Worker...");
  const workers = await createWorkers();
  logger.info(`Started ${workers.length} queue workers`);

  const shutdown = async () => {
    logger.info("Shutting down workers...");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
