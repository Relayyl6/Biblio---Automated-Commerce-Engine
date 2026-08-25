import { logger } from "@ace/shared/logger.js";
import { redis } from "@ace/shared/clients";
async function main() {
  const info = await redis.xinfo('GROUPS', 'stream:payments.verified');
  logger.log('Groups:', JSON.stringify(info, null, 2));
  process.exit(0);
}
main();
