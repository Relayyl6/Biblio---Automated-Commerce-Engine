import { logger } from "@ace/shared/logger.js";
import { sql, redis } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

export async function setupOutboxRelay() {
  const domainQueue = new Queue("domain-events", {
    connection: { ...redis.options, maxRetriesPerRequest: null },
  });

  const dlqQueue = new Queue("domain-events-dlq", {
    connection: { ...redis.options, maxRetriesPerRequest: null },
  });

  logger.log("[OutboxRelay] Initializing Outbox polling mechanism with backpressure, DLQ & exponential backoff retry...");

  let isPolling = false;
  let lastErrorTime = 0;
  let lastErrorMessage = "";

  const interval = setInterval(async () => {
    if (isPolling) return; // Prevent concurrent polling runs from stacking up connections
    isPolling = true;

    try {
      // 0. Recover stalled events stuck in 'processing' for > 2 minutes (e.g. from a crashed pod)
      // Retryable events are restored to pending with a short backoff; exhausted events go to dead_letter
      await sql`
        UPDATE outbox_events
        SET status = 'pending',
            retry_count = COALESCE(retry_count, 0) + 1,
            next_retry_at = NOW() + INTERVAL '10 seconds'
        WHERE status = 'processing'
          AND created_at < NOW() - INTERVAL '2 minutes'
          AND COALESCE(retry_count, 0) < COALESCE(max_retries, 3);
      `.catch((e: any) =>
        logger.warn(`[OutboxRelay] Notice recovering stale processing events: ${e.message}`)
      );

      await sql`
        UPDATE outbox_events
        SET status = 'dead_letter',
            last_error = 'Stalled in processing state > 2 minutes and exceeded maximum retries'
        WHERE status = 'processing'
          AND created_at < NOW() - INTERVAL '2 minutes'
          AND COALESCE(retry_count, 0) >= COALESCE(max_retries, 3);
      `.catch(() => {});

      // 1. Check queue backpressure before pulling more events from DB
      try {
        const waitingCount = await domainQueue.getWaitingCount();
        if (waitingCount > 500) {
          logger.warn(
            `[OutboxRelay] Queue backpressure high (${waitingCount} waiting jobs in domain-events). Pausing poll.`
          );
          return;
        }
      } catch (qErr: any) {
        logger.warn(`[OutboxRelay] Could not inspect domain-events queue depth (Redis down?): ${qErr.message}. Skipping poll turn.`);
        return;
      }

      // 2. Fetch pending events ready for dispatch (respecting exponential backoff next_retry_at)
      const events = await sql<{
        id: string;
        event_type: string;
        payload: any;
        retry_count: number | null;
        max_retries: number | null;
      }[]>`
        UPDATE outbox_events 
        SET status = 'processing' 
        WHERE id IN (
          SELECT id FROM outbox_events 
          WHERE status = 'pending'
            AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          ORDER BY created_at ASC 
          FOR UPDATE SKIP LOCKED 
          LIMIT 50
        )
        RETURNING id, event_type, payload, retry_count, max_retries;
      `;

      if (events.length > 0) {
        logger.log(`[OutboxRelay] Found ${events.length} pending outbox events. Relaying to BullMQ...`);

        const processedIds: string[] = [];

        // 3. Publish to BullMQ with individual error isolation and retry/DLQ logic
        for (const evt of events) {
          try {
            await domainQueue.add(evt.event_type, evt.payload, {
              jobId: evt.id,
              removeOnComplete: true,
              removeOnFail: false,
            });
            processedIds.push(evt.id);
          } catch (pubErr: any) {
            const currentRetries = evt.retry_count ?? 0;
            const maxAllowed = evt.max_retries ?? 3;
            const newRetryCount = currentRetries + 1;
            const errorMsg = pubErr?.message || String(pubErr);

            logger.error(
              `[OutboxRelay] Failed to enqueue event ${evt.id} to BullMQ: ${errorMsg}`,
              { eventId: evt.id, attempt: newRetryCount, maxAllowed }
            );

            if (newRetryCount >= maxAllowed) {
              // Move to Dead Letter Queue and mark status as dead_letter
              await sql`
                UPDATE outbox_events
                SET status = 'dead_letter',
                    retry_count = ${newRetryCount},
                    last_error = ${errorMsg}
                WHERE id = ${evt.id}::uuid
              `.catch(() => {});

              await dlqQueue.add(
                "dead-letter-event",
                {
                  eventId: evt.id,
                  eventType: evt.event_type,
                  payload: evt.payload,
                  failedAt: new Date().toISOString(),
                  reason: errorMsg,
                  totalAttempts: newRetryCount,
                },
                { jobId: `dlq_${evt.id}` }
              ).catch(dlqErr => logger.error(`[OutboxRelay] Failed to push event ${evt.id} to DLQ`, { dlqErr, eventId: evt.id }));

              logger.error(`[OutboxRelay] Event ${evt.id} exceeded ${maxAllowed} attempts — moved to dead_letter`, { eventId: evt.id });
            } else {
              // Apply exponential backoff (e.g. 5s, 10s, 20s, 40s, capped at 300s)
              const backoffSec = Math.min(300, Math.pow(2, newRetryCount) * 5);
              await sql`
                UPDATE outbox_events
                SET status = 'pending',
                    retry_count = ${newRetryCount},
                    next_retry_at = NOW() + (${backoffSec} * INTERVAL '1 second'),
                    last_error = ${errorMsg}
                WHERE id = ${evt.id}::uuid
              `.catch(() => {});

              logger.warn(
                `[OutboxRelay] Scheduled event ${evt.id} retry with exponential backoff (${backoffSec}s)`,
                { eventId: evt.id, retryInSec: backoffSec, attempt: newRetryCount }
              );
            }
          }
        }

        // 4. Mark successfully enqueued events as processed (using published_at column)
        if (processedIds.length > 0) {
          await sql`
            UPDATE outbox_events 
            SET status = 'processed', published_at = NOW(), last_error = NULL 
            WHERE id = ANY(${processedIds})
          `;
        }

        logger.log(`[OutboxRelay] Successfully relayed ${processedIds.length}/${events.length} events.`);
      }

      // Reset error tracking on success
      lastErrorMessage = "";
    } catch (err: any) {
      const now = Date.now();
      const msg = err?.message || String(err);
      // Throttle errors to once every 60s per unique message to avoid flooding stdout
      if (msg !== lastErrorMessage || now - lastErrorTime > 60000) {
        lastErrorMessage = msg;
        lastErrorTime = now;
        logger.warn(`[OutboxRelay] Notice polling outbox_events: ${msg}. Will retry...`);
      }
    } finally {
      isPolling = false;
    }
  }, 5000); // Poll every 5 seconds

  return {
    domainQueue,
    dlqQueue,
    interval,
    async close() {
      clearInterval(interval);
      await domainQueue.close();
      await dlqQueue.close();
    },
  };
}
