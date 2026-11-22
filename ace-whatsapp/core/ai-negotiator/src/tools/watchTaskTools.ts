import { WatchTaskService } from '../services/watchTaskService.js';
import type { WatchTaskCriteria, WatchTaskChannel, WatchTaskStatus } from '@ace/shared/types';

export const watchTaskToolDefinitions = [
  {
    name: 'create_watch_task',
    description:
      'Schedule a background watch task when a customer requests a product that is genuinely out of stock or unavailable. ' +
      'Do NOT call this if the item is in stock. Confirm criteria with the customer first if vague. ' +
      'The background system watches inventory and alerts the customer automatically the moment it arrives.',
    input_schema: {
      type: 'object',
      properties: {
        criteria: {
          type: 'object',
          description: 'Parsed criteria for the item the customer wants',
          properties: {
            item: { type: 'string', description: 'Product type or name (e.g. "jacket", "running shoes", "lace fabric")' },
            color: { type: 'string', description: 'Color requested (e.g. "blue", "white", "emerald green")' },
            size: { type: 'string', description: 'Size requested (e.g. "XL", "42", "6 yards")' },
            brand: { type: 'string', description: 'Brand requested if any' },
            max_price: { type: 'number', description: 'Customer maximum budget or price ceiling in Naira' },
            min_price: { type: 'number', description: 'Customer minimum price floor if specified' },
            attributes: { type: 'object', description: 'Other customer preferences (fabric type, material, style, etc.)' },
            ongoing: { type: 'boolean', description: 'True if customer asked for ongoing alerts even after first match; defaults to false' },
          },
          required: ['item'],
        },
        expiry: {
          type: 'string',
          description: 'Task lifetime (e.g. "14d", "30d", or ISO date string). Defaults to 14 days.',
        },
        notify_channel: {
          type: 'string',
          enum: ['whatsapp', 'in_app', 'sms'],
          description: 'Notification channel to alert the customer through. Defaults to whatsapp.',
        },
      },
      required: ['criteria'],
    },
  },
  {
    name: 'list_watch_tasks',
    description: "List the customer's current watch tasks to check what items the system is actively monitoring for them.",
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'fulfilled', 'cancelled', 'expired', 'all'],
          description: 'Filter tasks by status. Defaults to active.',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_watch_task',
    description:
      'Update the criteria (e.g. change color, size, or price limit) or extend the expiry of an existing watch task at the customer\'s request.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID of the watch task to update' },
        new_criteria: {
          type: 'object',
          description: 'Updated criteria fields',
          properties: {
            item: { type: 'string' },
            color: { type: 'string' },
            size: { type: 'string' },
            brand: { type: 'string' },
            max_price: { type: 'number' },
            min_price: { type: 'number' },
            attributes: { type: 'object' },
            ongoing: { type: 'boolean' },
          },
        },
        new_expiry: { type: 'string', description: 'Updated expiry duration or date (e.g. "30d")' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'cancel_watch_task',
    description: 'Cancel an active watch task when the customer mentions they bought it elsewhere or no longer want alerts for it.',
    input_schema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID of the watch task to cancel' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'match_inventory',
    description:
      'Evaluate specific criteria against the verified store catalog to find ranked exact matches and close alternatives. ' +
      'Returns only verified stock. Never guess.',
    input_schema: {
      type: 'object',
      properties: {
        criteria: {
          type: 'object',
          properties: {
            item: { type: 'string', description: 'Item name or query' },
            color: { type: 'string' },
            size: { type: 'string' },
            brand: { type: 'string' },
            max_price: { type: 'number' },
            min_price: { type: 'number' },
          },
          required: ['item'],
        },
      },
      required: ['criteria'],
    },
  },
  {
    name: 'notify_customer',
    description: 'Send a notification to the customer about a confirmed matching item that has arrived in stock.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Friendly, natural notification message to send' },
        items: {
          type: 'array',
          items: { type: 'object' },
          description: 'List of matching items found',
        },
        task_id: { type: 'string', description: 'Optional watch task ID to mark fulfilled' },
      },
      required: ['items'],
    },
  },
];

export async function handleWatchTaskTool(
  toolName: string,
  input: any,
  context: { merchantId: string; customerId: string }
): Promise<any> {
  const { merchantId, customerId } = context;

  switch (toolName) {
    case 'create_watch_task': {
      const criteria: WatchTaskCriteria = input.criteria;
      return await WatchTaskService.createWatchTask({
        customerId,
        merchantId,
        criteria,
        expiry: input.expiry,
        notifyChannel: (input.notify_channel as WatchTaskChannel) || 'whatsapp',
      });
    }

    case 'list_watch_tasks': {
      const status = (input.status as WatchTaskStatus | 'all') || 'active';
      const tasks = await WatchTaskService.listWatchTasks(customerId, status, merchantId);
      return {
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          criteria: t.criteria,
          status: t.status,
          expiry: t.expiry,
          created_at: t.created_at,
        })),
      };
    }

    case 'update_watch_task': {
      const updated = await WatchTaskService.updateWatchTask({
        taskId: input.task_id,
        customerId,
        newCriteria: input.new_criteria,
        newExpiry: input.new_expiry,
      });
      if (!updated) {
        return { error: 'Watch task not found or unauthorized' };
      }
      return {
        success: true,
        message: `Watch task updated successfully.`,
        task: updated,
      };
    }

    case 'cancel_watch_task': {
      const res = await WatchTaskService.cancelWatchTask(input.task_id, customerId);
      if (!res.success) {
        return { error: 'Task not found or already cancelled' };
      }
      return {
        success: true,
        message: `I've cancelled that watch task. You won't receive alerts for it anymore.`,
      };
    }

    case 'match_inventory': {
      return await WatchTaskService.matchInventory(merchantId, input.criteria);
    }

    case 'notify_customer': {
      return await WatchTaskService.notifyCustomer({
        customerId,
        merchantId,
        message: input.message,
        items: input.items,
        taskId: input.task_id,
      });
    }

    default:
      throw new Error(`Unknown watch task tool: ${toolName}`);
  }
}
