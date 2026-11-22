import { logger } from '@ace/shared/logger.js';
import { redis } from '@ace/shared/clients.js';
import { WatchTaskService } from '../../../ai-negotiator/src/services/watchTaskService.js';

export async function setupWatchTaskSchedulerFlow() {
  logger.info('[WatchTaskSchedulerFlow] Initializing automated watch task scheduler and event hook...');

  // 1. Initial sweep on startup
  WatchTaskService.runScheduledSweep().catch((err) => {
    logger.error('[WatchTaskSchedulerFlow] Error during initial sweep:', err);
  });

  // 2. Periodic background scheduler (every 10 minutes)
  const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
  const intervalId = setInterval(async () => {
    try {
      logger.info('[WatchTaskSchedulerFlow] Running periodic watch task sweep...');
      const result = await WatchTaskService.runScheduledSweep();
      logger.info('[WatchTaskSchedulerFlow] Sweep completed', result);
    } catch (err: any) {
      logger.error('[WatchTaskSchedulerFlow] Sweep failed:', err.message);
    }
  }, SWEEP_INTERVAL_MS);

  // 3. Real-time Inventory Event Listener via Redis Pub/Sub
  const subRedis = redis.duplicate();
  await subRedis.subscribe('events:inventory:updated', 'inventory:restocked', 'product:created').catch((err) => {
    logger.warn('[WatchTaskSchedulerFlow] Redis subscription warning:', err.message);
  });

  subRedis.on('message', async (channel, message) => {
    try {
      const data = JSON.parse(message);
      const merchantId = data.merchantId || data.merchant_id;
      if (merchantId) {
        logger.info(`[WatchTaskSchedulerFlow] Event received on ${channel} for merchant ${merchantId}`);
        await WatchTaskService.onInventoryChanged(merchantId, data);
      }
    } catch (err: any) {
      logger.error('[WatchTaskSchedulerFlow] Error handling inventory event message:', err.message);
    }
  });

  logger.info('[WatchTaskSchedulerFlow] Watch task scheduler and event hook active.');

  return {
    close: async () => {
      clearInterval(intervalId);
      try {
        await subRedis.quit();
      } catch {}
    },
  };
}
