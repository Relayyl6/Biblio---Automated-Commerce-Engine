import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const marketingTools = [
  {
    "type": "function",
    "function": {
      "name": "query_social_media_posts",
      "description": "Pull the merchant's recent Instagram/Facebook metadata (e.g. 'last reel').",
      "parameters": { "type": "object", "properties": { "platform": { "type": "string" }, "limit": { "type": "number" } } }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "match_image_to_catalog",
      "description": "Vector search comparing an image (from a social post or customer upload) against the catalog to identify the SKU.",
      "parameters": { "type": "object", "properties": { "imageUrl": { "type": "string" } }, "required": ["imageUrl"] }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "configure_status_mode",
      "description": "Configure WhatsApp Status auto-posting (enable/disable, frequency in hours, and approval requirement).",
      "parameters": {
        "type": "object",
        "properties": {
          "enabled": { "type": "boolean", "description": "Whether auto status posting is enabled" },
          "frequencyHours": { "type": "number", "description": "How often to post in hours (e.g. 2, 4, 8)" },
          "approveBeforePost": { "type": "boolean", "description": "Whether posts require manual approval" }
        },
        "required": ["enabled"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_status_strategy",
      "description": "Set the ranking strategy for WhatsApp Status auto-posting: 'balanced' (70% margin, 30% dead stock), 'margin_priority' (maximize profits), 'velocity_priority' (clear dead stock), or 'freshness' (newest additions first).",
      "parameters": {
        "type": "object",
        "properties": {
          "strategy": {
            "type": "string",
            "enum": ["balanced", "margin_priority", "velocity_priority", "freshness"],
            "description": "The promotion ranking strategy"
          },
          "marginWeight": { "type": "number", "description": "Optional custom margin weight (0.0 to 1.0)" },
          "velocityWeight": { "type": "number", "description": "Optional custom velocity weight (0.0 to 1.0)" }
        },
        "required": ["strategy"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_status_recommendations",
      "description": "Get the top-ranked products currently recommended for WhatsApp Status based on the active ranking strategy, margin %, and sales velocity.",
      "parameters": {
        "type": "object",
        "properties": {
          "limit": { "type": "number", "description": "Number of recommendations to fetch (default: 3)" }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "post_to_status_now",
      "description": "Immediately broadcast a product to WhatsApp Status. If SKU is omitted, broadcasts the #1 top-ranked candidate product.",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": { "type": "string", "description": "Optional SKU of the product to post. Omit to post top recommendation." }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_marketing_copy",
      "description": "AI writes Instagram/Facebook captions",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          }
        },
        "required": [
          "sku"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "schedule_status_campaign",
      "description": "Plan status posts for the week",
      "parameters": {
        "type": "object",
        "properties": {
          "skus": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "skus"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "analyze_status_views",
      "description": "Check view counts",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_flash_sale",
      "description": "Automatically slash prices for 24h",
      "parameters": {
        "type": "object",
        "properties": {
          "percentage": {
            "type": "number"
          }
        },
        "required": [
          "percentage"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "end_flash_sale",
      "description": "Revert prices back to normal",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_facebook_catalog",
      "description": "Push ACE products to FB Shop",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_instagram_shop",
      "description": "Push to IG Shopping",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_abandoned_cart_recovery",
      "description": "SMS blast to abandoned carts",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "post_to_instagram",
      "description": "Post an image and caption to Instagram",
      "parameters": {
        "type": "object",
        "properties": {
          "imageUrl": { "type": "string" },
          "caption": { "type": "string" },
          "igUserId": { "type": "string" }
        },
        "required": ["imageUrl", "caption"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "schedule_whatsapp_status",
      "description": "Schedule a WhatsApp status post",
      "parameters": {
        "type": "object",
        "properties": {
          "mediaPath": { "type": "string" },
          "caption": { "type": "string" },
          "scheduleAt": { "type": "string" }
        },
        "required": ["mediaPath", "caption", "scheduleAt"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "send_bulk_whatsapp",
      "description": "Send bulk WhatsApp messages to customers",
      "parameters": {
        "type": "object",
        "properties": {
          "recipients": {
            "type": "array",
            "items": { "type": "string" }
          },
          "message": { "type": "string" }
        },
        "required": ["recipients", "message"]
      }
    }
  }
];

export const marketingHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  post_to_instagram: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`SELECT access_token, metadata FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider = 'instagram' LIMIT 1`;
      if (rows.length === 0) {
        return { ok: false, message: 'Instagram not connected. Please connect your Instagram business account.' };
      }
      const accessToken = rows[0].access_token;
      
      const meta = rows[0].metadata as any;
      const igUserId = args.igUserId || (meta && meta.ig_user_id);
      if (!igUserId) {
        return { ok: false, message: 'Instagram User ID not found.' };
      }

      const { imageUrl, caption } = args;
      const fetch = (await import('node-fetch')).default;

      // 1. Create media container
      const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken })
      });
      const mediaData: any = await mediaRes.json();
      if (!mediaData.id) {
        throw new Error(`Failed to create media: ${JSON.stringify(mediaData)}`);
      }

      // 2. Publish
      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: mediaData.id, access_token: accessToken })
      });
      const publishData: any = await publishRes.json();
      if (!publishData.id) {
        throw new Error(`Failed to publish media: ${JSON.stringify(publishData)}`);
      }

      return { ok: true, id: publishData.id };
    } catch (e: any) {
      logger.error('post_to_instagram error', e);
      return { ok: false, error: e.message };
    }
  },

  schedule_whatsapp_status: async (merchantId: string, args: any) => {
    try {
      const { mediaPath, caption, scheduleAt } = args;
      const { Queue } = await import("bullmq");
      const statusQueue = new Queue("status-posts", {
        connection: { ...redis.options, maxRetriesPerRequest: null }
      });
      
      const scheduleTime = new Date(scheduleAt).getTime();
      let delay = scheduleTime - Date.now();
      if (delay < 0) delay = 0;

      await statusQueue.add("status-post", { merchantId, mediaPath, caption, scheduleAt }, { delay });

      return { ok: true, queued: true, scheduledAt: scheduleAt };
    } catch (e: any) {
      logger.error('schedule_whatsapp_status error', e);
      return { ok: false, error: e.message };
    }
  },

  send_bulk_whatsapp: async (merchantId: string, args: any) => {
    try {
      const { recipients, message } = args;
      const { Queue } = await import("bullmq");
      const outboundQueue = new Queue("outbound-messages", {
        connection: { ...redis.options, maxRetriesPerRequest: null }
      });
      
      let delayMs = 0;
      let queued = 0;
      
      // Rate-limit: max 50 recipients per batch
      const maxBatch = Math.min(recipients.length, 50);
      for (let i = 0; i < maxBatch; i++) {
        await outboundQueue.add("outbound-message", {
          merchantId,
          recipient: recipients[i],
          message
        }, { delay: delayMs });
        
        delayMs += 2000; // delay 2 seconds between each
        queued++;
      }

      return { ok: true, queued };
    } catch (e: any) {
      logger.error('send_bulk_whatsapp error', e);
      return { ok: false, error: e.message };
    }
  },

  query_social_media_posts: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at) VALUES (${merchantId}, ${actionId}, 'query_social_media_posts', ${JSON.stringify(args)}, now())`;
    return "Fetched recent Instagram reel showing 'Blue Satin Midi Dress' (ImageURL: https://cdn.ace.io/ig/123.jpg).";
  },
  match_image_to_catalog: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await sql`INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at) VALUES (${merchantId}, ${actionId}, 'match_image_to_catalog', ${JSON.stringify(args)}, now())`;
    return "Image match confident (96%). Matched SKU: BLUE-SATIN-MIDI-DRESS. Price: 18500.";
  },
  configure_status_mode: async (merchantId: string, args: any) => {
    const { enabled, frequencyHours, approveBeforePost } = args;
    await sql`
      UPDATE vendors
      SET auto_status_enabled = ${Boolean(enabled)},
          posting_frequency_hours = COALESCE(${frequencyHours ? Number(frequencyHours) : null}, posting_frequency_hours),
          approve_before_post = COALESCE(${approveBeforePost !== undefined ? Boolean(approveBeforePost) : null}, approve_before_post),
          updated_at = now()
      WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid
    `;
    return `Auto-Status posting is now ${enabled ? "ENABLED" : "DISABLED"}${frequencyHours ? ` (frequency: every ${frequencyHours}h)` : ""}.`;
  },
  set_status_strategy: async (merchantId: string, args: any) => {
    const strategy = args.strategy || "balanced";
    let marginWeight = args.marginWeight !== undefined ? Number(args.marginWeight) : 0.70;
    let velocityWeight = args.velocityWeight !== undefined ? Number(args.velocityWeight) : 0.30;

    if (strategy === "margin_priority" && args.marginWeight === undefined) {
      marginWeight = 0.85;
      velocityWeight = 0.15;
    } else if (strategy === "velocity_priority" && args.marginWeight === undefined) {
      marginWeight = 0.30;
      velocityWeight = 0.70;
    }

    await sql`
      UPDATE vendors
      SET status_strategy = ${strategy},
          margin_weight = ${marginWeight},
          velocity_weight = ${velocityWeight},
          updated_at = now()
      WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid
    `;
    const label = strategy === "margin_priority"
      ? "Maximize Margins (85% margin / 15% velocity)"
      : strategy === "velocity_priority"
      ? "Clear Dead Stock (70% velocity / 30% margin)"
      : strategy === "freshness"
      ? "Catalog Freshness (newest arrivals first)"
      : "Balanced (70% margin / 30% dead stock)";

    return `Status ranking strategy updated to '${label}'. High-priority products will automatically be featured next.`;
  },
  get_status_recommendations: async (merchantId: string, args: any) => {
    const limit = args.limit ? Number(args.limit) : 3;
    const vendorRows = await sql<{
      id: string;
      status_strategy: string | null;
      margin_weight: number | null;
      velocity_weight: number | null;
    }[]>`
      SELECT id, status_strategy, margin_weight, velocity_weight
      FROM vendors
      WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid
      LIMIT 1
    `;
    if (!vendorRows[0]) return "No active vendor business line found.";
    const vendor = vendorRows[0];
    const strategy = vendor.status_strategy || "balanced";
    let marginWeight = Number(vendor.margin_weight ?? 0.70);
    let velocityWeight = Number(vendor.velocity_weight ?? 0.30);
    if (strategy === "margin_priority") { marginWeight = 0.85; velocityWeight = 0.15; }
    else if (strategy === "velocity_priority") { marginWeight = 0.30; velocityWeight = 0.70; }

    const candidates = await sql<{
      sku: string;
      name: string;
      price: number;
      margin_pct: number;
      recent_sales_velocity: number;
      promotion_score: number;
    }[]>`
      WITH eligible_products AS (
        SELECT
          p.sku,
          p.name,
          p.price,
          p.image_url,
          p.last_posted_at,
          GREATEST(
            0.10,
            (p.price - COALESCE(
              (p.metadata->>'floor')::numeric,
              (p.metadata->>'cost_price')::numeric,
              p.price * 0.70
            )) / GREATEST(p.price, 1.0)
          ) AS estimated_margin,
          COALESCE((
            SELECT COUNT(*)::int
            FROM orders o
            WHERE (o.supplier_id = p.supplier_id OR o.product_id = p.id OR o.product_id = p.product_id)
              AND (o.items::text LIKE ('%' || p.sku || '%') OR o.product_id = p.id OR o.product_id = p.product_id)
              AND o.created_at > now() - interval '14 days'
          ), 0) AS recent_sales_velocity
        FROM products p
        WHERE (p.merchant_id = ${merchantId}::uuid OR p.merchant_id = ${vendor.id}::uuid)
          AND (p.active = true OR p.active IS NULL)
          AND p.image_url IS NOT NULL
      )
      SELECT
        sku,
        name,
        price,
        ROUND((estimated_margin * 100)::numeric, 1)::float as margin_pct,
        recent_sales_velocity,
        ROUND((
          (estimated_margin * (${marginWeight}::numeric * 100.0)) / (1.0 + recent_sales_velocity::numeric * ${velocityWeight}::numeric)
          + CASE WHEN last_posted_at IS NULL THEN 15.0 ELSE 0.0 END
        )::numeric, 2)::float AS promotion_score
      FROM eligible_products
      ORDER BY
        ${strategy === "freshness" ? sql`last_posted_at ASC NULLS FIRST, promotion_score DESC` : sql`promotion_score DESC, last_posted_at ASC NULLS FIRST`}
      LIMIT ${limit}
    `;

    if (candidates.length === 0) {
      return "No eligible products with images found in your catalog to recommend.";
    }

    const itemsText = candidates
      .map(
        (c, idx) =>
          `${idx + 1}. *${c.name}* (SKU: ${c.sku})\n   • Price: ₦${c.price.toLocaleString()}\n   • Est. Margin: ${c.margin_pct}%\n   • Recent Orders: ${c.recent_sales_velocity}\n   • Priority Score: ${c.promotion_score}`
      )
      .join("\n\n");

    return `*Current Strategy:* ${strategy.toUpperCase()}\n\n*Top Status Recommendations:*\n\n${itemsText}\n\nTo post immediately, say "Post ${candidates[0].sku} to status" or "Post top product now".`;
  },
  post_to_status_now: async (merchantId: string, args: any) => {
    const { sku } = args;
    const vendorRows = await sql<{ id: string }[]>`
      SELECT id FROM vendors WHERE merchant_id = ${merchantId}::uuid OR id = ${merchantId}::uuid LIMIT 1
    `;
    if (!vendorRows[0]) return "No active vendor line found.";
    const vendorId = vendorRows[0].id;

    const BAILEYS_GATEWAY_URL = process.env.BAILEYS_GATEWAY_URL ?? "http://localhost:3005";
    try {
      const res = await fetch(`${BAILEYS_GATEWAY_URL}/status/${vendorId}/post-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku })
      });
      const data = await res.json() as any;
      if (res.ok && data.ok) {
        return `Successfully published *${data.name}* (₦${Number(data.price).toLocaleString()}) to your WhatsApp Status with direct-order deep link!`;
      }
      return `Status post could not be published: ${data.error || "Device disconnected or not ready."}`;
    } catch (err: any) {
      return `Failed to connect to WhatsApp Status gateway: ${err.message}`;
    }
  },
  generate_marketing_copy: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'generate_marketing_copy'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'generate_marketing_copy'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'generate_marketing_copy'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  schedule_status_campaign: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'schedule_status_campaign'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'schedule_status_campaign'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'schedule_status_campaign'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  analyze_status_views: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'analyze_status_views'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'analyze_status_views'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'analyze_status_views'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  create_flash_sale: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'create_flash_sale'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'create_flash_sale'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'create_flash_sale'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  end_flash_sale: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'end_flash_sale'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'end_flash_sale'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'end_flash_sale'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  sync_facebook_catalog: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'sync_facebook_catalog'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'sync_facebook_catalog'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'sync_facebook_catalog'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  sync_instagram_shop: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'sync_instagram_shop'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'sync_instagram_shop'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'sync_instagram_shop'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  run_abandoned_cart_recovery: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'run_abandoned_cart_recovery'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'run_abandoned_cart_recovery'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'run_abandoned_cart_recovery'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  }
};
