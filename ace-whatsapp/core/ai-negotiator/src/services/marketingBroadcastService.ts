import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { loadNegotiatorEnv } from '@ace/shared/env.js';
import { sendCustomerMessage } from '../../../comms-router/src/outbound.js';

const env = loadNegotiatorEnv();
const groq = new Groq({ apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY || '' });
const GROQ_MODEL = env.GROQ_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export interface FlashSaleDetails {
  campaignId: string;
  title: string;
  discountPercent: number;
  productSkus: string[];
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'active' | 'ended';
}

export class MarketingBroadcastService {
  /**
   * AI-generated viral marketing copy tailored to Nigerian social commerce.
   */
  static async generateMarketingCopy(params: {
    merchantId: string;
    productName: string;
    price: number;
    platform: 'whatsapp_status' | 'instagram' | 'broadcast_dm';
    tone?: 'exciting' | 'exclusive' | 'humorous_pidgin' | 'professional';
    keyBenefits?: string[];
  }): Promise<{ headline: string; body: string; callToAction: string; fullCaption: string }> {
    const { productName, price, platform, tone = 'exciting', keyBenefits = [] } = params;

    const systemPrompt = `You are the lead social commerce copywriter for Nigerian WhatsApp & Instagram merchants.
Write high-converting, natural marketing copy for:
Product: ${productName}
Price: ₦${price.toLocaleString()}
Platform: ${platform}
Tone: ${tone}
Key Highlights: ${keyBenefits.join(', ') || 'Premium quality, fast delivery'}

Rules:
- Keep it concise, punchy, and culturally authentic.
- Use tasteful emojis without overdoing it.
- Include a clear call to action to message or order immediately.
- Return structured JSON: {"headline": "...", "body": "...", "callToAction": "...", "fullCaption": "..."}`;

    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return {
        headline: parsed.headline || `🔥 Hot Arrival: ${productName}!`,
        body: parsed.body || `Grab yours now at ₦${price.toLocaleString()}. Top quality guaranteed!`,
        callToAction: parsed.callToAction || 'Tap reply to order yours now before it sells out! ⚡',
        fullCaption: parsed.fullCaption || `${parsed.headline}\n\n${parsed.body}\n\n${parsed.callToAction}`,
      };
    } catch {
      const fallback = `🔥 Just In: ${productName}!\n\nGet yours today for only ₦${price.toLocaleString()}.\nLimited stock available in store.\n\n📲 Send a message now to secure yours!`;
      return {
        headline: `🔥 Just In: ${productName}!`,
        body: `Get yours today for only ₦${price.toLocaleString()}. Limited stock available.`,
        callToAction: '📲 Send a message now to secure yours!',
        fullCaption: fallback,
      };
    }
  }

  /**
   * Schedule a WhatsApp Status campaign for optimal viewer engagement hours.
   */
  static async scheduleWhatsAppStatus(params: {
    merchantId: string;
    caption: string;
    mediaUrl?: string;
    scheduledTime?: string;
  }): Promise<{ statusId: string; scheduledTime: string; message: string }> {
    const { merchantId, caption, mediaUrl, scheduledTime } = params;

    const statusId = `STS-${Date.now().toString(36).toUpperCase()}`;
    const targetTime = scheduledTime || new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await sql`
      INSERT INTO scheduled_status_posts (
        status_id, merchant_id, caption, media_url, scheduled_at, status, created_at
      ) VALUES (
        ${statusId}, ${merchantId}::uuid, ${caption}, ${mediaUrl || null}, ${targetTime}, 'scheduled', now()
      )
    `.catch(() => {});

    logger.info('[MarketingBroadcastService] Scheduled WhatsApp status', { statusId, targetTime });

    return {
      statusId,
      scheduledTime: targetTime,
      message: `WhatsApp status post scheduled for ${new Date(targetTime).toLocaleTimeString()}. It will publish automatically via your Baileys gateway.`,
    };
  }

  /**
   * Launch a limited-time flash sale campaign with price overrides.
   */
  static async createFlashSale(params: {
    merchantId: string;
    title: string;
    discountPercent: number;
    productSkus: string[];
    durationHours?: number;
  }): Promise<FlashSaleDetails> {
    const { merchantId, title, discountPercent, productSkus, durationHours = 24 } = params;

    const campaignId = `FLASH-${Date.now().toString(36).toUpperCase()}`;
    const startsAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    // Record flash sale in registry
    await sql`
      INSERT INTO flash_sales (
        campaign_id, merchant_id, title, discount_percent, product_skus, starts_at, ends_at, status, created_at
      ) VALUES (
        ${campaignId}, ${merchantId}::uuid, ${title}, ${discountPercent}, ${productSkus}, ${startsAt}, ${endsAt}, 'active', now()
      )
    `.catch(() => {});

    // Apply temporary price drops to products
    const multiplier = 1 - discountPercent / 100;
    await sql`
      UPDATE products
      SET price = ROUND((price * ${multiplier})::numeric, -2),
          updated_at = now()
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND sku = ANY(${productSkus})
    `.catch(() => {});

    logger.info('[MarketingBroadcastService] Launched flash sale', { campaignId, discountPercent, productSkus });

    return {
      campaignId,
      title,
      discountPercent,
      productSkus,
      startsAt,
      endsAt,
      status: 'active',
    };
  }

  /**
   * End a flash sale campaign and revert baseline prices.
   */
  static async endFlashSale(merchantId: string, campaignId: string): Promise<{ success: boolean; message: string }> {
    const saleRows = await sql`
      SELECT * FROM flash_sales WHERE campaign_id = ${campaignId} AND merchant_id = ${merchantId}::uuid
    `.catch(() => []);

    if (!saleRows[0]) {
      throw new Error(`Flash sale ${campaignId} not found`);
    }

    const sale = saleRows[0];
    const discount = Number(sale.discount_percent);
    const restoreMultiplier = 1 / (1 - discount / 100);

    // Revert prices
    await sql`
      UPDATE products
      SET price = ROUND((price * ${restoreMultiplier})::numeric, -2),
          updated_at = now()
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND sku = ANY(${sale.product_skus})
    `.catch(() => {});

    await sql`
      UPDATE flash_sales
      SET status = 'ended', updated_at = now()
      WHERE campaign_id = ${campaignId}
    `;

    return {
      success: true,
      message: `Flash sale ${campaignId} ended. Standard catalog prices have been restored.`,
    };
  }

  /**
   * Run automated abandoned cart recovery workflow on unpaid customer carts.
   */
  static async runAbandonedCartRecovery(merchantId: string): Promise<{ recoveredAttempted: number; messagesSent: number }> {
    const abandonedOrders = await sql<{
      id: string;
      order_number: string;
      customer_id: string;
      customer_phone: string;
      total_amount: number;
      created_at: string;
      items: any;
    }[]>`
      SELECT id, order_number, customer_id, customer_phone, total_amount, created_at, items
      FROM orders
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND payment_status = 'unpaid'
        AND created_at BETWEEN NOW() - INTERVAL '6 hours' AND NOW() - INTERVAL '1 hour'
      LIMIT 20
    `.catch(() => []);

    let sent = 0;
    for (const order of abandonedOrders) {
      const phone = order.customer_phone || order.customer_id;
      if (!phone) continue;

      const itemsArr = Array.isArray(order.items) ? order.items : [];
      const itemNames = itemsArr.map((it: any) => it.name || it.sku).join(', ') || 'your selected items';

      const recoveryMsg = `Hi there! 👋 We noticed you left *${itemNames}* (₦${Number(order.total_amount).toLocaleString()}) in your bag.\n\n` +
        `We've held your items safely for you. Would you like me to send your instant checkout link to lock your order before stock runs out?`;

      try {
        await sendCustomerMessage({ toPhone: phone, text: recoveryMsg }, undefined, merchantId);
        sent++;
      } catch (err: any) {
        logger.warn('[MarketingBroadcastService] Abandoned cart recovery send failed:', err.message);
      }
    }

    return {
      recoveredAttempted: abandonedOrders.length,
      messagesSent: sent,
    };
  }
}
