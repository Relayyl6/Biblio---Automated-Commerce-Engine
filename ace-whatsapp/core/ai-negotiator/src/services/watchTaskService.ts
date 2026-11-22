import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import type {
  CustomerWatchTask,
  WatchTaskCriteria,
  WatchTaskStatus,
  WatchTaskChannel,
  InventoryMatchResult,
} from '@ace/shared/types';
import { sendCustomerMessage } from '../../../comms-router/src/outbound.js';

export class WatchTaskService {
  /**
   * Parse human duration string ("14d", "30d", "7d") or ISO date string into a Date object.
   * Defaults to 14 days from now.
   */
  static parseExpiry(expiryStr?: string): Date {
    if (!expiryStr) {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d;
    }

    const trimmed = expiryStr.trim().toLowerCase();
    const match = trimmed.match(/^(\d+)\s*(d|day|days|w|week|weeks|m|month|months)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2];
      const d = new Date();
      if (unit.startsWith('d')) {
        d.setDate(d.getDate() + num);
      } else if (unit.startsWith('w')) {
        d.setDate(d.getDate() + num * 7);
      } else if (unit.startsWith('m')) {
        d.setMonth(d.getMonth() + num);
      }
      return d;
    }

    const parsed = new Date(expiryStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Default to 14 days
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 14);
    return fallback;
  }

  /**
   * Create a new watch task for unfulfilled customer requests.
   * Checks for duplicate active requests first to prevent redundant alerts.
   */
  static async createWatchTask(params: {
    customerId: string;
    merchantId: string;
    criteria: WatchTaskCriteria;
    expiry?: string;
    notifyChannel?: WatchTaskChannel;
  }): Promise<{ task: CustomerWatchTask; duplicate: boolean; message: string }> {
    const {
      customerId,
      merchantId,
      criteria,
      expiry,
      notifyChannel = 'whatsapp',
    } = params;

    const expiryDate = this.parseExpiry(expiry);
    const itemQuery = (criteria.item || criteria.raw_query || '').trim().toLowerCase();

    // 1. Check for duplicate active watch task for the same customer & merchant
    const existingActive = await sql<CustomerWatchTask[]>`
      SELECT * FROM customer_watch_tasks
      WHERE customer_id = ${customerId}
        AND merchant_id = ${merchantId}::uuid
        AND status = 'active'
        AND expiry > now()
    `;

    for (const existing of existingActive) {
      const existingItem = (existing.criteria.item || existing.criteria.raw_query || '').toLowerCase();
      const sameItem = existingItem === itemQuery || existingItem.includes(itemQuery) || itemQuery.includes(existingItem);
      const sameColor = (!criteria.color && !existing.criteria.color) || 
        (criteria.color?.toLowerCase() === existing.criteria.color?.toLowerCase());
      const sameSize = (!criteria.size && !existing.criteria.size) || 
        (criteria.size?.toLowerCase() === existing.criteria.size?.toLowerCase());

      if (sameItem && sameColor && sameSize) {
        logger.info('[WatchTaskService] Duplicate active watch task detected; reusing existing', {
          taskId: existing.id,
          customerId,
          merchantId,
        });
        return {
          task: existing,
          duplicate: true,
          message: `I'm already keeping watch for that for you! The moment one arrives, I'll message you right here.`,
        };
      }
    }

    // 2. Insert new watch task
    const rows = await sql<CustomerWatchTask[]>`
      INSERT INTO customer_watch_tasks (
        customer_id,
        merchant_id,
        criteria,
        status,
        expiry,
        notify_channel,
        last_checked_at,
        created_at,
        updated_at
      ) VALUES (
        ${customerId},
        ${merchantId}::uuid,
        ${jsonb(criteria)},
        'active',
        ${expiryDate.toISOString()},
        ${notifyChannel},
        now(),
        now(),
        now()
      ) RETURNING *
    `;

    const task = rows[0];
    logger.info('[WatchTaskService] Created watch task', {
      taskId: task.id,
      customerId,
      merchantId,
      criteria,
      expiry: expiryDate.toISOString(),
    });

    // Publish event on Redis
    await redis.publish(
      `agent:tasks:${merchantId}`,
      JSON.stringify({ type: 'watch_task_created', task, timestamp: Date.now() })
    ).catch(() => {});

    const itemName = [criteria.color, criteria.item].filter(Boolean).join(' ');
    const replyMessage = `We don't have that in stock right now, but I'll keep watch for ${itemName || 'it'} and message you here the moment a match arrives. You can change or cancel anytime.`;

    return { task, duplicate: false, message: replyMessage };
  }

  /**
   * List watch tasks for a customer
   */
  static async listWatchTasks(
    customerId: string,
    status?: WatchTaskStatus | 'all',
    merchantId?: string
  ): Promise<CustomerWatchTask[]> {
    if (merchantId) {
      if (status && status !== 'all') {
        return await sql<CustomerWatchTask[]>`
          SELECT * FROM customer_watch_tasks
          WHERE customer_id = ${customerId}
            AND merchant_id = ${merchantId}::uuid
            AND status = ${status}
          ORDER BY created_at DESC
        `;
      }
      return await sql<CustomerWatchTask[]>`
        SELECT * FROM customer_watch_tasks
        WHERE customer_id = ${customerId}
          AND merchant_id = ${merchantId}::uuid
        ORDER BY created_at DESC
      `;
    }

    if (status && status !== 'all') {
      return await sql<CustomerWatchTask[]>`
        SELECT * FROM customer_watch_tasks
        WHERE customer_id = ${customerId}
          AND status = ${status}
        ORDER BY created_at DESC
      `;
    }

    return await sql<CustomerWatchTask[]>`
      SELECT * FROM customer_watch_tasks
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC
    `;
  }

  /**
   * Update watch task criteria or expiry
   */
  static async updateWatchTask(params: {
    taskId: string;
    customerId?: string;
    newCriteria?: Partial<WatchTaskCriteria>;
    newExpiry?: string;
  }): Promise<CustomerWatchTask | null> {
    const { taskId, customerId, newCriteria, newExpiry } = params;

    const existingRows = customerId
      ? await sql<CustomerWatchTask[]>`SELECT * FROM customer_watch_tasks WHERE id = ${taskId}::uuid AND customer_id = ${customerId}`
      : await sql<CustomerWatchTask[]>`SELECT * FROM customer_watch_tasks WHERE id = ${taskId}::uuid`;

    if (!existingRows[0]) {
      return null;
    }

    const task = existingRows[0];
    const mergedCriteria: WatchTaskCriteria = {
      ...task.criteria,
      ...(newCriteria || {}),
    };

    const updatedExpiry = newExpiry ? this.parseExpiry(newExpiry).toISOString() : task.expiry;

    const updatedRows = await sql<CustomerWatchTask[]>`
      UPDATE customer_watch_tasks
      SET criteria = ${jsonb(mergedCriteria)},
          expiry = ${updatedExpiry},
          updated_at = now()
      WHERE id = ${taskId}::uuid
      RETURNING *
    `;

    logger.info('[WatchTaskService] Updated watch task', { taskId, mergedCriteria });
    return updatedRows[0] || null;
  }

  /**
   * Cancel a watch task
   */
  static async cancelWatchTask(taskId: string, customerId?: string): Promise<{ success: boolean; task: CustomerWatchTask | null }> {
    const rows = customerId
      ? await sql<CustomerWatchTask[]>`
          UPDATE customer_watch_tasks
          SET status = 'cancelled', updated_at = now()
          WHERE id = ${taskId}::uuid AND customer_id = ${customerId}
          RETURNING *
        `
      : await sql<CustomerWatchTask[]>`
          UPDATE customer_watch_tasks
          SET status = 'cancelled', updated_at = now()
          WHERE id = ${taskId}::uuid
          RETURNING *
        `;

    if (rows[0]) {
      logger.info('[WatchTaskService] Cancelled watch task', { taskId });
      return { success: true, task: rows[0] };
    }
    return { success: false, task: null };
  }

  /**
   * Match criteria against store inventory.
   * Returns verified ranked matches: exactMatches (all criteria satisfied)
   * and closeAlternatives (close matches, clearly separated and labeled).
   */
  static async matchInventory(
    merchantId: string,
    criteria: WatchTaskCriteria
  ): Promise<{ exactMatches: InventoryMatchResult[]; closeAlternatives: InventoryMatchResult[] }> {
    const itemKeyword = (criteria.item || criteria.raw_query || '').trim();
    if (!itemKeyword) {
      return { exactMatches: [], closeAlternatives: [] };
    }

    const like = `%${itemKeyword}%`;

    // Fetch verified active products with actual stock
    const products = await sql<{
      id: string;
      sku: string | null;
      name: string;
      stock: number | null;
      quantity: number | null;
      price: number;
      description: any;
      detailed_description: string | null;
      category: string | null;
      colors: any;
      sizes: any;
      metadata: Record<string, any> | null;
      image_url: string | null;
    }[]>`
      SELECT id, sku, name, stock, quantity, price, description, detailed_description,
             category, colors, sizes, metadata, image_url
      FROM products
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND (active = true OR available = true OR status = 'active')
        AND (COALESCE(stock, quantity, 0) > 0)
        AND (
          name ILIKE ${like}
          OR (sku IS NOT NULL AND sku ILIKE ${like})
          OR (category IS NOT NULL AND category ILIKE ${like})
          OR (detailed_description IS NOT NULL AND detailed_description ILIKE ${like})
          OR (description IS NOT NULL AND description::text ILIKE ${like})
        )
      LIMIT 25
    `;

    const exactMatches: InventoryMatchResult[] = [];
    const closeAlternatives: InventoryMatchResult[] = [];

    const targetColor = criteria.color?.trim().toLowerCase();
    const targetSize = criteria.size?.trim().toLowerCase();
    const targetBrand = criteria.brand?.trim().toLowerCase();
    const maxPrice = criteria.max_price;
    const minPrice = criteria.min_price;

    for (const p of products) {
      const pName = (p.name || '').toLowerCase();
      const pDesc = (
        typeof p.description === 'object' && p.description?.text
          ? p.description.text
          : typeof p.description === 'string'
          ? p.description
          : p.detailed_description || ''
      ).toLowerCase();
      const pCategory = (p.category || '').toLowerCase();
      const pColorsStr = JSON.stringify(p.colors || '').toLowerCase();
      const pSizesStr = JSON.stringify(p.sizes || '').toLowerCase();
      const pMetaStr = JSON.stringify(p.metadata || '').toLowerCase();
      const matchedAttrs: Record<string, string> = {};

      let isExact = true;
      let score = 1.0;

      // Color check
      if (targetColor) {
        const hasColor =
          pColorsStr.includes(targetColor) ||
          pName.includes(targetColor) ||
          pDesc.includes(targetColor) ||
          pMetaStr.includes(targetColor);
        if (hasColor) {
          matchedAttrs.color = targetColor;
        } else {
          isExact = false;
          score -= 0.2;
        }
      }

      // Size check
      if (targetSize) {
        const hasSize =
          pSizesStr.includes(targetSize) ||
          pName.includes(targetSize) ||
          pDesc.includes(targetSize) ||
          pMetaStr.includes(targetSize);
        if (hasSize) {
          matchedAttrs.size = targetSize;
        } else {
          isExact = false;
          score -= 0.2;
        }
      }

      // Brand check
      if (targetBrand) {
        const hasBrand = pMetaStr.includes(targetBrand) || pName.includes(targetBrand);
        if (hasBrand) {
          matchedAttrs.brand = targetBrand;
        } else {
          isExact = false;
          score -= 0.2;
        }
      }

      // Price checks
      const priceNum = Number(p.price);
      if (maxPrice !== undefined && maxPrice !== null && priceNum > maxPrice) {
        // Price exceeds customer ceiling
        isExact = false;
        score -= 0.3;
      }
      if (minPrice !== undefined && minPrice !== null && priceNum < minPrice) {
        score -= 0.1;
      }

      const verifiedStock = Number(p.stock ?? p.quantity ?? 0);
      const matchItem: InventoryMatchResult = {
        sku: p.sku || p.id,
        name: p.name,
        price: priceNum,
        stock: verifiedStock,
        description: pDesc,
        image_url: p.image_url,
        match_score: Math.max(0.1, score),
        is_exact_match: isExact,
        matched_attributes: matchedAttrs,
      };

      if (isExact) {
        exactMatches.push(matchItem);
      } else {
        closeAlternatives.push(matchItem);
      }
    }

    exactMatches.sort((a, b) => b.match_score - a.match_score);
    closeAlternatives.sort((a, b) => b.match_score - a.match_score);

    return { exactMatches, closeAlternatives };
  }

  /**
   * Notify customer with matching item details and update watch task status.
   */
  static async notifyCustomer(params: {
    customerId: string;
    merchantId: string;
    message?: string;
    items: InventoryMatchResult[];
    taskId?: string;
    notifyChannel?: WatchTaskChannel;
  }): Promise<{ sent: boolean }> {
    const { customerId, merchantId, items, taskId, notifyChannel = 'whatsapp' } = params;

    if (items.length === 0) {
      return { sent: false };
    }

    const topItem = items[0];
    const formattedPrice = `₦${topItem.price.toLocaleString()}`;
    const defaultMsg = `Good news! We just restocked "${topItem.name}" at ${formattedPrice} (${topItem.stock} available). Would you like me to reserve one for you?`;
    const finalMessage = params.message || defaultMsg;

    // Send via channel
    if (notifyChannel === 'whatsapp') {
      await sendCustomerMessage(
        {
          toPhone: customerId,
          text: finalMessage,
        },
        undefined,
        merchantId
      ).catch((err) => {
        logger.error('[WatchTaskService] Failed to send WhatsApp notification to customer', {
          customerId,
          error: err.message,
        });
      });
    }

    // Always publish to Redis for in-app / web notifications
    await redis.publish(
      `agent:tasks:${merchantId}`,
      JSON.stringify({
        type: 'watch_task_match_notified',
        customerId,
        taskId,
        items,
        message: finalMessage,
        timestamp: Date.now(),
      })
    ).catch(() => {});

    // Update task status in database if taskId was provided
    if (taskId) {
      const task = await sql<CustomerWatchTask[]>`
        SELECT * FROM customer_watch_tasks WHERE id = ${taskId}::uuid LIMIT 1
      `;
      const isOngoing = task[0]?.criteria?.ongoing === true;

      await sql`
        UPDATE customer_watch_tasks
        SET status = ${isOngoing ? 'active' : 'fulfilled'},
            matched_items = ${jsonb(items)},
            notification_sent = true,
            notification_sent_at = now(),
            last_checked_at = now(),
            updated_at = now()
        WHERE id = ${taskId}::uuid
      `;
      logger.info('[WatchTaskService] Marked watch task notified/fulfilled', { taskId, isOngoing });
    }

    return { sent: true };
  }

  /**
   * Background Scheduler Sweep:
   * 1. Marks expired tasks as 'expired'.
   * 2. Runs matchInventory for active tasks with notification_sent = false.
   * 3. Sends notification and marks task fulfilled upon match.
   */
  static async runScheduledSweep(): Promise<{
    expiredCount: number;
    checkedCount: number;
    matchesFound: number;
  }> {
    // 1. Expire past tasks
    const expiredRows = await sql`
      UPDATE customer_watch_tasks
      SET status = 'expired', updated_at = now()
      WHERE status = 'active' AND expiry <= now()
      RETURNING id
    `;
    const expiredCount = expiredRows.length;

    // 2. Fetch active tasks that haven't been notified yet
    const activeTasks = await sql<CustomerWatchTask[]>`
      SELECT * FROM customer_watch_tasks
      WHERE status = 'active'
        AND expiry > now()
        AND notification_sent = false
      ORDER BY created_at ASC
      LIMIT 100
    `;

    let matchesFound = 0;

    for (const task of activeTasks) {
      try {
        const { exactMatches } = await this.matchInventory(task.merchant_id, task.criteria);
        if (exactMatches.length > 0) {
          matchesFound++;
          await this.notifyCustomer({
            customerId: task.customer_id,
            merchantId: task.merchant_id,
            items: exactMatches,
            taskId: task.id,
            notifyChannel: task.notify_channel,
          });
        } else {
          // Update last_checked_at timestamp
          await sql`
            UPDATE customer_watch_tasks
            SET last_checked_at = now(), updated_at = now()
            WHERE id = ${task.id}::uuid
          `;
        }
      } catch (err: any) {
        logger.error('[WatchTaskService] Error processing active watch task in sweep', {
          taskId: task.id,
          error: err.message,
        });
      }
    }

    return {
      expiredCount,
      checkedCount: activeTasks.length,
      matchesFound,
    };
  }

  /**
   * Real-time Inventory Change Hook:
   * Triggers immediately on inventory events (new product added, restock, price change).
   */
  static async onInventoryChanged(
    merchantId: string,
    event?: { productId?: string; sku?: string; action?: string }
  ): Promise<{ evaluated: number; notified: number }> {
    logger.info('[WatchTaskService] Inventory change event received; evaluating active watch tasks', {
      merchantId,
      event,
    });

    const activeTasks = await sql<CustomerWatchTask[]>`
      SELECT * FROM customer_watch_tasks
      WHERE merchant_id = ${merchantId}::uuid
        AND status = 'active'
        AND expiry > now()
        AND notification_sent = false
    `;

    let notified = 0;

    for (const task of activeTasks) {
      try {
        const { exactMatches } = await this.matchInventory(merchantId, task.criteria);
        if (exactMatches.length > 0) {
          notified++;
          await this.notifyCustomer({
            customerId: task.customer_id,
            merchantId,
            items: exactMatches,
            taskId: task.id,
            notifyChannel: task.notify_channel,
          });
        }
      } catch (err: any) {
        logger.error('[WatchTaskService] Error evaluating watch task on inventory change', {
          taskId: task.id,
          error: err.message,
        });
      }
    }

    return { evaluated: activeTasks.length, notified };
  }
}
