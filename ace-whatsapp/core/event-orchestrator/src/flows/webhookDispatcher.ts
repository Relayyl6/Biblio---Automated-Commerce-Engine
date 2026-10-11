import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";

export async function handleWebhookFanning(eventName: string, payload: any) {
  try {
    const merchantId = payload?.merchantId;
    if (!merchantId) {
      logger.warn(`[WebhookDispatcher] No merchantId in payload for event ${eventName}`);
      return;
    }

    // Query real DB for merchant webhook registrations
    const matchingWebhooks = await sql`
      SELECT url, headers
      FROM merchant_webhooks
      WHERE merchant_id = ${merchantId}
        AND (event = ${eventName} OR event = '*')
        AND active = true
    `;

    if (matchingWebhooks.length === 0) {
      logger.log(`[WebhookDispatcher] No webhooks registered for ${merchantId} / ${eventName}`);
      return;
    }

    // Fan out to all matching endpoints in parallel
    await Promise.allSettled(
      matchingWebhooks.map(async (webhook: any) => {
        logger.log(`[WebhookDispatcher] Fanning out ${eventName} to ${webhook.url}`);
        try {
          const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(webhook.headers as Record<string, string>)
            },
            body: JSON.stringify({ event: eventName, ...payload })
          });
          if (!res.ok) {
            logger.warn(`[WebhookDispatcher] Non-200 from ${webhook.url}: ${res.status}`);
          } else {
            logger.log(`[WebhookDispatcher] Successfully dispatched to ${webhook.url}`);
          }
        } catch (err: any) {
          logger.error(`[WebhookDispatcher] Failed to dispatch to ${webhook.url}: ${err.message}`);
        }
      })
    );
  } catch (err) {
    logger.error(`[WebhookDispatcher] Error processing webhooks for ${eventName}:`, err);
  }
}

