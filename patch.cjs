const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/state-machine/src/orderStateMachine.ts', 'utf8');

if (!code.includes('import { Queue } from "bullmq";')) {
  code = code.replace(
    /import \{ redis, sql \} from "@ace\/shared\/clients\.js";/,
    `import { redis, sql } from "@ace/shared/clients.js";
import { Queue } from "bullmq";

const domainEventsQueue = new Queue("domain-events", {
  connection: { ...redis.options, maxRetriesPerRequest: null }
});`
  );
}

code = code.replace(
  /await redis\.publish\("events:payment_confirmed", JSON\.stringify\(\{\s*merchantId, customerId, orderId, timestamp: Date\.now\(\)\s*\}\)\);/g,
  `await domainEventsQueue.add("payment_confirmed", { merchantId, customerId, orderId, timestamp: Date.now() }, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });`
);

code = code.replace(
  /await redis\.publish\("events:order_completed", JSON\.stringify\(\{\s*merchantId, customerId, orderId, timestamp: Date\.now\(\)\s*\}\)\);/g,
  `await domainEventsQueue.add("order_completed", { merchantId, customerId, orderId, timestamp: Date.now() }, { attempts: 5, backoff: { type: "exponential", delay: 2000 } });`
);

fs.writeFileSync('ace-whatsapp/core/state-machine/src/orderStateMachine.ts', code, 'utf8');
