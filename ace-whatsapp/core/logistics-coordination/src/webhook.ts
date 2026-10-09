import fastify, { FastifyInstance } from 'fastify';
import { DispatchRouter } from './router.js';
import { notifyCustomerOfDelivery } from './notifier.js';
import { sql } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';

const router = new DispatchRouter();

export function buildLogisticsWebhook(): FastifyInstance {
  const app = fastify({ logger: true });

  app.post('/webhooks/logistics/:provider', async (request, reply) => {
    const { provider } = request.params as { provider: 'kwik' | 'sendbox' };
    const payload = request.body;
    
    // 1. Fetch the correct adapter
    const adapter = router.getProvider(provider);
    if (!adapter) {
      return reply.status(400).send({ error: 'Unknown logistics provider' });
    }

    // 2. Verify signature
    const signature = request.headers['x-webhook-signature'] as string || '';
    if (!adapter.verifyWebhook(signature, payload)) {
      request.log.warn({ provider, signature }, 'Invalid webhook signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // 3. Parse standardized update
    const update = adapter.parseWebhook(payload);
    if (!update) {
      return reply.status(200).send({ message: 'Irrelevant webhook event, ignored.' });
    }

    // 4. Look up the orderId via the trackingNumber from the real DB
    const orderRows = await sql`
      SELECT merchant_id, customer_id, id as order_id
      FROM orders
      WHERE tracking_number = ${update.trackingNumber}
      LIMIT 1
    `;

    if (orderRows.length === 0) {
      logger.warn(`[logistics-webhook] No order found for tracking number: ${update.trackingNumber}`);
      return reply.status(200).send({ received: true, note: 'Order not found for tracking number' });
    }

    const { merchant_id, customer_id, order_id } = orderRows[0];
    request.log.info({ update, merchant_id, customer_id }, 'Logistics tracking update parsed');

    // 5. Take action based on status
    if (update.status === 'delivered') {
      await notifyCustomerOfDelivery(merchant_id, customer_id, update.trackingNumber);
    } else if (update.status === 'failed') {
      logger.error({ trackingNumber: update.trackingNumber, order_id }, 'Delivery failed or returned');
    }

    reply.status(200).send({ received: true });
  });

  return app;
}

