// shared/src/background-jobs/index.ts
//
// Role: Multi-App Background Worker Pool
// Centralizes the BullMQ configuration and worker registry for cross-cutting asynchronous concerns
// (e.g., scheduled re-engagement campaigns, delayed communications, analytics flushing).

import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import { redis } from '../clients.js';
import { dataIntelligence } from '../data-intelligence/engine.js';

export interface BaseJobPayload {
  merchantId: string;
  metadata?: Record<string, unknown>;
}

export type JobHandler<T extends BaseJobPayload> = (job: Job<T>) => Promise<void>;

export class BackgroundEngine {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  /**
   * Registers a new queue and its corresponding processor.
   */
  public registerQueue<T extends BaseJobPayload>(
    queueName: string, 
    handler: JobHandler<T>, 
    concurrency: number = 5
  ): Queue<T> {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName) as Queue<T>;
    }

    const queue = new Queue<T>(queueName, { connection: redis as any });
    this.queues.set(queueName, queue);

    const worker = new Worker<T>(queueName, handler, {
      connection: redis as any,
      concurrency
    });

    worker.on('failed', async (job: Job<T> | undefined, err: Error) => {
      console.error(`[WorkerEngine] ❌ Job ${job?.id} in ${queueName} failed:`, err);
      if (job) {
        await dataIntelligence.auditLog({
          service: 'background-engine',
          merchantId: job.data.merchantId,
          action: 'job_failed',
          metadata: { queue: queueName, error: err.message }
        });
      }
    });

    worker.on('completed', (job: Job<T>) => {
      console.log(`[WorkerEngine] ✅ Job ${job.id} in ${queueName} completed successfully.`);
    });

    this.workers.set(queueName, worker);
    return queue;
  }

  /**
   * Gracefully shuts down all workers.
   */
  public async shutdown(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}

export const backgroundEngine = new BackgroundEngine();
