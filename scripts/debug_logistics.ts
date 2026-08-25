import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients";
async function main() {
  logger.log("Reading...");
  try {
    const results = await redis.xreadgroup("GROUP", "logistics-coordination", "test", "COUNT", "10", "STREAMS", "stream:payments.verified", ">");
    logger.log("Raw results type:", typeof results, Array.isArray(results) ? "array" : "not array");
    logger.log("Raw results:", JSON.stringify(results, null, 2));
    
    if (results) {
      for (const [, messages] of results as any) {
        logger.log("Inner messages:", messages);
      }
    }
  } catch (err) {
    logger.error("Error:", err);
  }
  process.exit(0);
}
main();
