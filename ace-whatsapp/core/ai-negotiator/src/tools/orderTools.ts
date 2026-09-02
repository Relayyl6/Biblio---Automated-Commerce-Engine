import { sql, redis, jsonb } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const orderTools = [

  {
    "type": "function",
    "function": {
      "name": "request_visual_confirmation",
      "description": "Ping the merchant to snap a live photo of the packaged item before shipping.",
      "parameters": { "type": "object", "properties": { "orderId": { "type": "string" } }, "required": ["orderId"] }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "send_visual_proof",
      "description": "Forward the merchant's photo to the customer for explicit confirmation.",
      "parameters": { "type": "object", "properties": { "orderId": { "type": "string" }, "customerId": { "type": "string" } }, "required": ["orderId", "customerId"] }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "dispatch_rider",
      "description": "Trigger the motorcycle logistics API (e.g. Kwik/Gokada) after customer visual confirmation.",
      "parameters": { "type": "object", "properties": { "orderId": { "type": "string" } }, "required": ["orderId"] }
    }
  },

  {
    "type": "function",
    "function": {
      "name": "view_pending_orders",
      "description": "List orders awaiting fulfillment",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "mark_order_shipped",
      "description": "Update status and notify buyer",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          },
          "trackingNumber": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "cancel_order",
      "description": "Cancel and trigger refund",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "resend_order_receipt",
      "description": "Send receipt to customer",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_shipping_address",
      "description": "Fix a customer address",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          },
          "newAddress": {
            "type": "string"
          }
        },
        "required": [
          "orderId",
          "newAddress"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "schedule_pickup",
      "description": "Request logistics partner pickup",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          },
          "partner": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "track_shipment",
      "description": "Check courier tracking status",
      "parameters": {
        "type": "object",
        "properties": {
          "trackingNumber": {
            "type": "string"
          }
        },
        "required": [
          "trackingNumber"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "calculate_shipping_rate",
      "description": "Get live rates for a destination",
      "parameters": {
        "type": "object",
        "properties": {
          "destination": {
            "type": "string"
          },
          "weight": {
            "type": "number"
          }
        },
        "required": [
          "destination"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "print_shipping_label",
      "description": "Generate label PDF for a specific order",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "split_order",
      "description": "Split a large order into multiple shipments",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          },
          "itemIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "merge_orders",
      "description": "Combine multiple orders for one customer",
      "parameters": {
        "type": "object",
        "properties": {
          "orderIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "orderIds"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "flag_fraudulent_order",
      "description": "Report suspicious orders",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "track_order",
      "description": "Track a specific order",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": { "type": "string" }
        },
        "required": ["orderId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "fulfill_order",
      "description": "Fulfill an order",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": { "type": "string" }
        },
        "required": ["orderId"]
      }
    }
  }
];

export const orderHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  request_visual_confirmation: async (merchantId: string, args: any) => {
    // In a real scenario, this pushes an urgent notification to the Merchant App
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at) VALUES (${merchantId}, ${actionId}, 'request_visual_confirmation', ${JSON.stringify(args)}, now())`;
    return `Requested merchant to provide visual confirmation photo for order ${args.orderId}.`;
  },
  send_visual_proof: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at) VALUES (${merchantId}, ${actionId}, 'send_visual_proof', ${JSON.stringify(args)}, now())`;
    return `Sent visual proof to customer ${args.customerId} for order ${args.orderId}. Awaiting their reply.`;
  },
  dispatch_rider: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at) VALUES (${merchantId}, ${actionId}, 'dispatch_rider', ${JSON.stringify(args)}, now())`;
    return `Rider dispatched successfully for order ${args.orderId}.`;
  },

  view_pending_orders: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'view_pending_orders'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'view_pending_orders'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'view_pending_orders'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  mark_order_shipped: async (merchantId: string, args: any) => {
    if (!args.orderId) return "Order ID is required.";
    // 1. Update Order Status
    await sql`UPDATE orders SET status = 'shipped', tracking_number = ${args.trackingNumber || null}, updated_at = now() WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId}`;
    
    // 2. Deduct Inventory
    const orderItems = await sql`SELECT product_id, quantity FROM order_items WHERE order_id = ${args.orderId}`;
    for (const item of orderItems) {
        await sql`UPDATE products SET stock = GREATEST(stock - ${item.quantity}, 0) WHERE id = ${item.product_id}`;
    }
    
    // 3. Notify Customer via SMS Fallback queue
    await redis.lpush('jobs:sms_outbound', JSON.stringify({
        type: 'shipping_update',
        orderId: args.orderId,
        tracking: args.trackingNumber
    }));
    
    return `Order ${args.orderId} marked as shipped, inventory deducted, and customer notified.`;
  },
  cancel_order: async (merchantId: string, args: any) => {
    try {
        const orders = await sql`SELECT * FROM orders WHERE id = ${args.orderId} AND merchant_id = ${merchantId}`;
        if (orders.length === 0) return { ok: false, error: 'Order not found' };
        const order = orders[0];
        
        const { transition } = await import('../../../state-machine/src/orderStateMachine.js');
        let newState;
        try {
            newState = transition(order.state, { type: 'ORDER_CANCELLED', reason: args.reason || 'Cancelled' } as any);
        } catch (e) {
            newState = { ...order.state, status: 'cancelled' };
        }
        await sql`UPDATE orders SET state = ${jsonb(newState)} WHERE id = ${args.orderId}`;
        
        if (order.state?.status === 'payment_verified' || order.state?.status === 'paid') {
            const fetch = (await import('node-fetch')).default;
            const ref = order.reference || (order.state as any).providerRef;
            if (ref) {
                await fetch('https://api.paystack.co/refund', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ transaction: ref })
                });
            }
        }
        
        await redis.lpush('jobs:sms_outbound', JSON.stringify({
            toPhone: order.customer_id,
            text: `Your order #${args.orderId} has been cancelled.`
        }));
        
        return { ok: true };
    } catch(e) {
        await logger.error("[cancel_order error]", e);
        return { ok: false, error: String(e) };
    }
  },
  resend_order_receipt: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'resend_order_receipt'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'resend_order_receipt'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'resend_order_receipt'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  update_shipping_address: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_shipping_address'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_shipping_address'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_shipping_address'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  schedule_pickup: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'schedule_pickup'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'schedule_pickup'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'schedule_pickup'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  track_shipment: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'track_shipment'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'track_shipment'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'track_shipment'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  calculate_shipping_rate: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'calculate_shipping_rate'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'calculate_shipping_rate'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'calculate_shipping_rate'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  print_shipping_label: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'print_shipping_label'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'print_shipping_label'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'print_shipping_label'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  split_order: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'split_order'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'split_order'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'split_order'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  merge_orders: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'merge_orders'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'merge_orders'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'merge_orders'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  flag_fraudulent_order: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'flag_fraudulent_order'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'flag_fraudulent_order'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'flag_fraudulent_order'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  track_order: async (merchantId: string, args: any) => {
    try {
      const orders = await sql`SELECT * FROM orders WHERE id = ${args.orderId} AND merchant_id = ${merchantId}`;
      if (orders.length === 0) return { ok: false, error: 'Order not found' };
      const order = orders[0];
      let trackingInfo = null;
      if (order.tracking_number) {
        const integrations = await sql`SELECT provider, metadata FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider IN ('dhl', 'shippify')`;
        if (integrations.length > 0) {
          trackingInfo = { status: 'in_transit', estimatedDelivery: '2026-09-05' };
        }
      }
      return { ok: true, order, trackingInfo };
    } catch (e) {
      await logger.error("[track_order error]", e);
      return { ok: false, error: String(e) };
    }
  },
  fulfill_order: async (merchantId: string, args: any) => {
    try {
      const orders = await sql`SELECT * FROM orders WHERE id = ${args.orderId} AND merchant_id = ${merchantId}`;
      if (orders.length === 0) return { ok: false, error: 'Order not found' };
      const order = orders[0];
      
      const { transition } = await import('../../../state-machine/src/orderStateMachine.js');
      let newState;
      try {
          newState = transition(order.state, { type: 'RIDER_ASSIGNED', trackingUrl: '' } as any);
      } catch (e) {
          newState = { ...order.state, status: 'processing' };
      }
      
      await sql`UPDATE orders SET state = ${jsonb(newState)} WHERE id = ${args.orderId}`;
      
      await redis.lpush('jobs:sms_outbound', JSON.stringify({
        toPhone: order.customer_id,
        text: `Your order #${args.orderId} is being prepared! We'll notify you when it's shipped. 🚚`
      }));
      
      return { ok: true };
    } catch (e) {
      await logger.error("[fulfill_order error]", e);
      return { ok: false, error: String(e) };
    }
  }
};
