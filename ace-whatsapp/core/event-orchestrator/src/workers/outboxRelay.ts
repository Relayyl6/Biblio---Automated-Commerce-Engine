import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function setupOutboxRelay() {
  const domainQueue = new Queue("domain-events", { connection: { ...redis.options, maxRetriesPerRequest: null } });
  logger.log("[OutboxRelay] Initializing Outbox polling mechanism...");

  setInterval(async () => {
    try {
      // 1. Fetch pending events (lock them so concurrent pods don't double-process)
      const events = await sql`
        UPDATE outbox_events 
        SET status = 'processing' 
        WHERE id IN (
          SELECT id FROM outbox_events 
          WHERE status = 'pending' 
          ORDER BY created_at ASC 
          FOR UPDATE SKIP LOCKED 
          LIMIT 50
        )
        RETURNING *;
      `;

      if (events.length === 0) return;

      logger.log(`[OutboxRelay] Found ${events.length} pending outbox events. Relaying to BullMQ...`);

      // 2. Publish to BullMQ
      for (const evt of events) {
        await domainQueue.add(evt.event_type, evt.payload, {
          jobId: evt.id,
          removeOnComplete: true,
          removeOnFail: false
        });
      }

      // 3. Mark as processed
      const ids = events.map(e => e.id);
      await sql`
        UPDATE outbox_events 
        SET status = 'processed', processed_at = NOW() 
        WHERE id = ANY(${ids})
      `;

      logger.log(`[OutboxRelay] Successfully relayed ${events.length} events.`);
    } catch (err) {
      logger.error("[OutboxRelay] Error polling outbox_events:", err);
    }
  }, 5000); // Poll every 5 seconds
}

