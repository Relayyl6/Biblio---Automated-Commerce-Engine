import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients";
async function main() {
  const res = await redis.xreadgroup("GROUP", "logistics-coordination", "test-consumer", "COUNT", "10", "STREAMS", "stream:payments.verified", ">");
  logger.log(JSON.stringify(res, null, 2));
  process.exit(0);
}
main();
