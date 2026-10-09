import { Queue } from "bullmq";
import { redis } from "./clients.js";
import { logger } from "./logger.js";

export class DomainEventBus {
  private queue: Queue;

  constructor() {
    this.queue = new Queue("domain-events", {
      connection: { ...redis.options, maxRetriesPerRequest: null },
    });
    
    this.queue.on('error', (err) => {
      logger.error("[DomainEventBus] Redis error:", err);
    });
  }

  async publish(eventName: string, payload: any, opts?: any) {
    try {
      await this.queue.add(eventName, payload, opts);
      logger.log(`[DomainEventBus] Published event: ${eventName}`);
    } catch (err) {
      logger.error(`[DomainEventBus] Failed to publish event: ${eventName}`, err);
    }
  }
}

export const eventBus = new DomainEventBus();
