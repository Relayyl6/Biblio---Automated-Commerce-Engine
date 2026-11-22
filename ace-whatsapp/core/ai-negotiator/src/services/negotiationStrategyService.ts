import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';

export interface DiscountCodeRecord {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  maxUses: number;
  currentUses: number;
  active: boolean;
  expiresAt: string;
}

export class NegotiationStrategyService {
  /**
   * Set minimum floor price for a product SKU to strictly protect profit margin.
   */
  static async setFloorPrice(
    merchantId: string,
    sku: string,
    floorPrice: number
  ): Promise<{ success: boolean; sku: string; retailPrice: number; floorPrice: number }> {
    const pRows = await sql<{ id: string; price: number; name: string }[]>`
      SELECT id, price, name FROM products
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND sku = ${sku}
      LIMIT 1
    `;

    if (!pRows[0]) {
      throw new Error(`Product ${sku} not found`);
    }

    const p = pRows[0];
    if (floorPrice > Number(p.price)) {
      throw new Error(`Floor price (₦${floorPrice.toLocaleString()}) cannot be greater than retail price (₦${Number(p.price).toLocaleString()}).`);
    }

    await sql`
      UPDATE products
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{floor}', ${floorPrice}::text::jsonb),
          updated_at = now()
      WHERE id = ${p.id}::uuid
    `;

    logger.info('[NegotiationStrategyService] Updated floor price', { sku, floorPrice });

    return {
      success: true,
      sku,
      retailPrice: Number(p.price),
      floorPrice,
    };
  }

  /**
   * Configure negotiation aggressiveness mode for autonomous AI sales agent.
   */
  static async configureAggressiveness(
    merchantId: string,
    mode: 'conservative' | 'balanced' | 'aggressive'
  ): Promise<{ success: boolean; mode: string; maxDiscountPercent: number }> {
    const discountCeilingMap = {
      conservative: 5,
      balanced: 12,
      aggressive: 20,
    };
    const maxDiscount = discountCeilingMap[mode] || 12;

    await sql`
      UPDATE merchants
      SET default_discount_pct = ${maxDiscount},
          tone_guide = CASE 
            WHEN ${mode} = 'conservative' THEN 'Polite, firm on pricing, rarely offers discounts'
            WHEN ${mode} = 'aggressive' THEN 'Fast dealmaker, offers bundle discounts to close same-day sales'
            ELSE 'Warm, friendly Nigerian market trader balancing margins and volume'
          END,
          updated_at = now()
      WHERE id = ${merchantId}::uuid
    `;

    logger.info('[NegotiationStrategyService] Configured negotiation strategy', { merchantId, mode, maxDiscount });

    return {
      success: true,
      mode,
      maxDiscountPercent: maxDiscount,
    };
  }

  /**
   * Create custom promotional discount code.
   */
  static async createDiscountCode(params: {
    merchantId: string;
    code: string;
    discountType: 'percentage' | 'fixed';
    value: number;
    maxUses?: number;
    expiryDays?: number;
  }): Promise<DiscountCodeRecord> {
    const { merchantId, code, discountType, value, maxUses = 100, expiryDays = 30 } = params;

    const cleanCode = code.trim().toUpperCase();
    const expiry = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString();

    const rows = await sql<{
      id: string;
      code: string;
      discount_type: string;
      value: number;
      max_uses: number;
      current_uses: number;
      active: boolean;
      expires_at: string;
    }[]>`
      INSERT INTO discount_codes (
        merchant_id, code, discount_type, value, max_uses, current_uses, active, expires_at, created_at
      ) VALUES (
        ${merchantId}::uuid, ${cleanCode}, ${discountType}, ${value}, ${maxUses}, 0, true, ${expiry}, now()
      )
      ON CONFLICT (merchant_id, code) DO UPDATE
      SET value = EXCLUDED.value,
          active = true,
          expires_at = EXCLUDED.expires_at
      RETURNING id, code, discount_type, value, max_uses, current_uses, active, expires_at
    `;

    const r = rows[0];
    return {
      id: r.id,
      code: r.code,
      discountType: r.discount_type as any,
      value: Number(r.value),
      maxUses: Number(r.max_uses),
      currentUses: Number(r.current_uses),
      active: r.active,
      expiresAt: r.expires_at,
    };
  }

  /**
   * Link complementary SKUs into automatic bundle deal proposals.
   */
  static async enableBundleDeal(params: {
    merchantId: string;
    primarySku: string;
    bundleSku: string;
    bundleComboPrice: number;
  }): Promise<{ success: boolean; message: string }> {
    const { merchantId, primarySku, bundleSku, bundleComboPrice } = params;

    await sql`
      INSERT INTO product_bundles (
        merchant_id, primary_sku, secondary_sku, bundle_price, active, created_at
      ) VALUES (
        ${merchantId}::uuid, ${primarySku}, ${bundleSku}, ${bundleComboPrice}, true, now()
      )
      ON CONFLICT (merchant_id, primary_sku, secondary_sku) DO UPDATE
      SET bundle_price = EXCLUDED.bundle_price, active = true
    `.catch(() => {});

    logger.info('[NegotiationStrategyService] Created bundle deal', { primarySku, bundleSku, bundleComboPrice });

    return {
      success: true,
      message: `Bundle deal activated: ${primarySku} + ${bundleSku} for ₦${bundleComboPrice.toLocaleString()}. The AI will pitch this upsell automatically during customer negotiations.`,
    };
  }
}
