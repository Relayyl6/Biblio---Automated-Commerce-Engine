import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients";
async function main() {
  const res = await redis.xpending("stream:payments.verified", "logistics-coordination");
  logger.log("XPENDING SUMMARY:", JSON.stringify(res, null, 2));
  
  const details = await redis.xpending("stream:payments.verified", "logistics-coordination", "-", "+", 10);
  logger.log("XPENDING DETAILS:", JSON.stringify(details, null, 2));
  
  // Try claiming them to see the format!
  const claimed = await redis.xclaim("stream:payments.verified", "logistics-coordination", "test-claimer", 0, details[0][0]);
  logger.log("XCLAIM FORMAT:", JSON.stringify(claimed, null, 2));
  process.exit(0);
}
main();
