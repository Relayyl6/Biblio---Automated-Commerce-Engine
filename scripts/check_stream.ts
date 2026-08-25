import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients";
async function main() {
  const len = await redis.xlen('stream:payments.verified');
  logger.log('Stream length:', len);
  const items = await redis.xrange('stream:payments.verified', '-', '+');
  logger.log('Items:', JSON.stringify(items, null, 2));
  process.exit(0);
}
main();
