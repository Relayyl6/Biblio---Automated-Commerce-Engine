import { sql, redis } from "@ace/shared/clients";
import { makeThirdPartyRequest } from "./utils.js";
import crypto from "crypto";

export const group1Handlers: Record<string, Function> = {
  // --- INVENTORY TOOLS ---
  add_inventory: async (merchantId: string, args: { name: string, price: number, stock?: number }) => {
    const sku = `SKU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    await sql`
      INSERT INTO inventory (merchant_id, sku, name, price, stock, created_at)
      VALUES (${merchantId}, ${sku}, ${args.name}, ${args.price}, ${args.stock || 0}, NOW())
    `;
    return { success: true, sku, message: "Inventory added." };
  },

  update_inventory: async (merchantId: string, args: { sku: string, price?: number, stock?: number }) => {
    if (args.price !== undefined && args.stock !== undefined) {
      await sql`UPDATE inventory SET price = ${args.price}, stock = ${args.stock}, updated_at = NOW() WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    } else if (args.price !== undefined) {
      await sql`UPDATE inventory SET price = ${args.price}, updated_at = NOW() WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    } else if (args.stock !== undefined) {
      await sql`UPDATE inventory SET stock = ${args.stock}, updated_at = NOW() WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    }
    return { success: true, message: \`Inventory updated for SKU \${args.sku}.\` };
  },

  delete_inventory: async (merchantId: string, args: { sku: string }) => {
    await sql`DELETE FROM inventory WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    return { success: true, message: \`Inventory deleted for SKU \${args.sku}.\` };
  },

  search_inventory: async (merchantId: string, args: { query: string }) => {
    const results = await sql`
      SELECT sku, name, price, stock FROM inventory 
      WHERE merchant_id = ${merchantId} AND (sku ILIKE ${'%' + args.query + '%'} OR name ILIKE ${'%' + args.query + '%'})
    `;
    return { success: true, results };
  },

  auto_restock_alert_config: async (merchantId: string, args: { sku: string, threshold: number }) => {
    await sql`
      UPDATE inventory SET restock_threshold = ${args.threshold}
      WHERE merchant_id = ${merchantId} AND sku = ${args.sku}
    `;
    return { success: true, message: \`Restock threshold set to \${args.threshold} for \${args.sku}.\` };
  },

  bulk_price_update: async (merchantId: string, args: { category?: string, percentage: number }) => {
    const multiplier = 1 + (args.percentage / 100);
    if (args.category) {
      await sql`
        UPDATE inventory SET price = price * ${multiplier}
        WHERE merchant_id = ${merchantId} AND category = ${args.category}
      `;
    } else {
      await sql`
        UPDATE inventory SET price = price * ${multiplier}
        WHERE merchant_id = ${merchantId}
      `;
    }
    return { success: true, message: \`Prices updated by \${args.percentage}%.\` };
  },

  generate_product_description: async (merchantId: string, args: { sku: string }) => {
    const item = await sql`SELECT name, category FROM inventory WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    if (!item.length) return { success: false, message: "Item not found" };
    const description = \`This is a premium \${item[0].name} suitable for all your needs.\`;
    await sql`UPDATE inventory SET description = ${description} WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    return { success: true, description };
  },

  categorize_product: async (merchantId: string, args: { sku: string, tags: string[] }) => {
    await sql`
      UPDATE inventory SET tags = ${args.tags}
      WHERE merchant_id = ${merchantId} AND sku = ${args.sku}
    `;
    return { success: true, message: \`Product \${args.sku} categorized.\` };
  },

  sync_shopify_inventory: async (merchantId: string, args: any) => {
    const shopifyData = await makeThirdPartyRequest('shopify', '/admin/api/2023-10/products.json', {});
    await redis.rpush(\`sync_jobs:\${merchantId}\`, JSON.stringify({ type: 'shopify', data: shopifyData }));
    return { success: true, message: "Shopify sync job queued." };
  },

  push_to_woocommerce: async (merchantId: string, args: any) => {
    const products = await sql`SELECT * FROM inventory WHERE merchant_id = ${merchantId}`;
    const wooResponse = await makeThirdPartyRequest('woocommerce', '/wp-json/wc/v3/products/batch', { create: products });
    return { success: true, message: "Pushed to WooCommerce.", data: wooResponse };
  },

  list_out_of_stock: async (merchantId: string, args: any) => {
    const results = await sql`
      SELECT sku, name FROM inventory 
      WHERE merchant_id = ${merchantId} AND stock <= 0
    `;
    return { success: true, out_of_stock: results };
  },

  archive_product: async (merchantId: string, args: { sku: string }) => {
    await sql`UPDATE inventory SET status = 'archived' WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    return { success: true, message: \`Product \${args.sku} archived.\` };
  },

  unarchive_product: async (merchantId: string, args: { sku: string }) => {
    await sql`UPDATE inventory SET status = 'active' WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    return { success: true, message: \`Product \${args.sku} unarchived.\` };
  },

  add_product_variant: async (merchantId: string, args: { sku: string, variantName: string, price?: number }) => {
    const variantId = \`VAR-\${crypto.randomBytes(4).toString('hex').toUpperCase()}\`;
    await sql`
      INSERT INTO product_variants (merchant_id, parent_sku, variant_id, variant_name, price)
      VALUES (${merchantId}, ${args.sku}, ${variantId}, ${args.variantName}, ${args.price || null})
    `;
    return { success: true, variantId, message: "Variant added." };
  },

  remove_product_variant: async (merchantId: string, args: { sku: string, variantId: string }) => {
    await sql`
      DELETE FROM product_variants WHERE merchant_id = ${merchantId} AND parent_sku = ${args.sku} AND variant_id = ${args.variantId}
    `;
    return { success: true, message: "Variant removed." };
  },

  set_minimum_order_quantity: async (merchantId: string, args: { sku: string, moq: number }) => {
    await sql`UPDATE inventory SET moq = ${args.moq} WHERE merchant_id = ${merchantId} AND sku = ${args.sku}`;
    return { success: true, message: \`MOQ set to \${args.moq} for \${args.sku}.\` };
  },

  // --- ORDER TOOLS ---
  view_pending_orders: async (merchantId: string, args: any) => {
    const orders = await sql`
      SELECT order_id, total, status FROM orders 
      WHERE merchant_id = ${merchantId} AND status = 'pending'
    `;
    return { success: true, orders };
  },

  mark_order_shipped: async (merchantId: string, args: { orderId: string, trackingNumber?: string }) => {
    await sql`
      UPDATE orders SET status = 'shipped', tracking_number = ${args.trackingNumber || null}
      WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId}
    `;
    await redis.rpush(\`notifications:\${merchantId}\`, JSON.stringify({ type: 'shipped', orderId: args.orderId }));
    return { success: true, message: \`Order \${args.orderId} marked as shipped.\` };
  },

  cancel_order: async (merchantId: string, args: { orderId: string, reason?: string }) => {
    await sql`
      UPDATE orders SET status = 'cancelled', cancel_reason = ${args.reason || 'Not specified'}
      WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId}
    `;
    return { success: true, message: \`Order \${args.orderId} cancelled.\` };
  },

  resend_order_receipt: async (merchantId: string, args: { orderId: string }) => {
    const order = await sql`SELECT * FROM orders WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId}`;
    if (!order.length) return { success: false, message: "Order not found" };
    await makeThirdPartyRequest('email_provider', '/send', { to: order[0].customer_email, subject: "Receipt", body: "..." });
    return { success: true, message: "Receipt resent." };
  },

  update_shipping_address: async (merchantId: string, args: { orderId: string, newAddress: string }) => {
    await sql`
      UPDATE orders SET shipping_address = ${args.newAddress}
      WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId}
    `;
    return { success: true, message: "Shipping address updated." };
  },

  schedule_pickup: async (merchantId: string, args: { orderId: string, partner?: string }) => {
    const partner = args.partner || 'DHL';
    const pickupRes = await makeThirdPartyRequest(partner, '/pickup', { orderId: args.orderId, date: new Date() });
    return { success: true, message: \`Pickup scheduled with \${partner}.\`, details: pickupRes };
  },

  track_shipment: async (merchantId: string, args: { trackingNumber: string }) => {
    const trackingInfo = await makeThirdPartyRequest('dhl', \`/track/\${args.trackingNumber}\`, {});
    return { success: true, tracking: trackingInfo };
  },

  calculate_shipping_rate: async (merchantId: string, args: { destination: string, weight?: number }) => {
    const rate = await makeThirdPartyRequest('easypost', '/rates', { destination: args.destination, weight: args.weight || 1 });
    return { success: true, rate };
  },

  print_shipping_label: async (merchantId: string, args: { orderId: string }) => {
    const labelUrl = \`https://labels.example.com/\${args.orderId}.pdf\`;
    return { success: true, labelUrl };
  },

  split_order: async (merchantId: string, args: { orderId: string, itemIds: string[] }) => {
    const newOrderId = \`ORD-\${crypto.randomBytes(4).toString('hex').toUpperCase()}\`;
    await sql`
      INSERT INTO orders (merchant_id, order_id, parent_order_id, status)
      VALUES (${merchantId}, ${newOrderId}, ${args.orderId}, 'pending')
    `;
    await sql`
      UPDATE order_items SET order_id = ${newOrderId}
      WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId} AND item_id = ANY(${args.itemIds})
    `;
    return { success: true, newOrderId, message: "Order split successfully." };
  },

  merge_orders: async (merchantId: string, args: { orderIds: string[] }) => {
    if (args.orderIds.length < 2) return { success: false, message: "Need at least 2 orders to merge." };
    const primaryId = args.orderIds[0];
    const secondaryIds = args.orderIds.slice(1);
    await sql`
      UPDATE order_items SET order_id = ${primaryId}
      WHERE merchant_id = ${merchantId} AND order_id = ANY(${secondaryIds})
    `;
    await sql`
      UPDATE orders SET status = 'merged_into_' || ${primaryId}
      WHERE merchant_id = ${merchantId} AND order_id = ANY(${secondaryIds})
    `;
    return { success: true, primaryId, message: "Orders merged." };
  },

  flag_fraudulent_order: async (merchantId: string, args: { orderId: string, reason?: string }) => {
    await sql`
      UPDATE orders SET is_fraud = true, fraud_reason = ${args.reason || 'Suspicious'}
      WHERE merchant_id = ${merchantId} AND order_id = ${args.orderId}
    `;
    await redis.rpush(\`fraud_alerts\`, JSON.stringify({ merchantId, orderId: args.orderId, reason: args.reason }));
    return { success: true, message: \`Order \${args.orderId} flagged as fraud.\` };
  }
};
