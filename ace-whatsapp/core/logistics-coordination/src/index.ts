export * from './worker.js';
export * from './types.js';
export * from './router.js';
export * from './notifier.js';
export { buildLogisticsWebhook } from './webhook.js';

import { buildLogisticsWebhook } from './webhook.js';

// Auto-start if run directly
if (import.meta.url.startsWith('file:') && process.argv[1] === new URL(import.meta.url).pathname) {
  const app = buildLogisticsWebhook();
  app.listen({ port: 4002, host: '0.0.0.0' }).then((address) => {
    console.log(`Logistics Webhook listening on ${address}`);
  }).catch(err => {
    console.error('Error starting Logistics Webhook', err);
    process.exit(1);
  });
}

