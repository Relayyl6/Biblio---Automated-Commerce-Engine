import "dotenv/config";
import { startLogisticsStreamConsumer } from "./streamConsumer";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info", name: "logistics-main" });

async function main() {
  logger.info("🚚 ACE Logistics Service initializing...");
  startLogisticsStreamConsumer();
  
  // Keep process alive
  process.on("SIGINT", () => {
    logger.info("Shutting down logistics service...");
    process.exit(0);
  });
}

main().catch(err => {
  logger.fatal({ err }, "Fatal error in logistics service");
  process.exit(1);
});
