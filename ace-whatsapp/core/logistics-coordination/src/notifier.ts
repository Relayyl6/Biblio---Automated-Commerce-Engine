import { Queue } from 'bullmq';
import { redis } from '@ace/shared/clients.js';
import P from 'pino';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

// We publish to the comms-router outbound queue to securely send WhatsApp messages
export const outboundQueue = new Queue('outbound_messages', {
  connection: { ...redis.options, maxRetriesPerRequest: null }
});

export async function notifyCustomerOfDispatch(
  merchantId: string, 
  customerId: string, 
  trackingNumber: string, 
  trackingUrl: string, 
  provider: string
) {
  try {
    const text = `📦 Your order has been dispatched via ${provider.toUpperCase()}!\n\nTracking Number: ${trackingNumber}\nTrack it here: ${trackingUrl}`;
    
    await outboundQueue.add('send_system_message', {
      merchantId,
      customerId,
      text,
      source: 'system' // explicitly not AI, so it bypasses AI debounce
    });
    
    logger.info({ merchantId, customerId, trackingNumber }, 'Enqueued dispatch notification');
  } catch (err) {
    logger.error({ err, merchantId, customerId }, 'Failed to enqueue dispatch notification');
  }
}

export async function notifyCustomerOfDelivery(
  merchantId: string, 
  customerId: string, 
  trackingNumber: string
) {
  try {
    const text = `✅ Great news! Your order (${trackingNumber}) has been marked as delivered.\n\nThank you for shopping with us! Let us know if you need any help.`;
    await outboundQueue.add('send_system_message', { merchantId, customerId, text, source: 'system' });
  } catch (err) {
    logger.error({ err, merchantId, customerId }, 'Failed to enqueue delivery notification');
  }
}
