import { logger } from "@ace/shared/logger.js";
// shared/src/identity-resolution/index.ts
//
// Role: Global Buyer ID Engine & Customer Graph
// Centralized service for tracking customer profiles across multiple merchants.
// Replaces the basic phone-number identifier with a unified cross-platform identity,
// enabling the 'one-tap checkout' network effect moat while maintaining strict NDPA 2023 compliance.

import { sql } from '../clients.js';
import { dataIntelligence } from '../data-intelligence/engine.js';
import twilio from 'twilio';
import crypto from 'crypto';

export interface CustomerProfile {
  globalBuyerId: string;
  phoneHash: string;
  name?: string;
  deliveryAddress?: string;
  crossMerchantOrderCount: number;
  tier?: string;
  createdAt: number;
}

export class IdentityResolutionEngine {
  
  private twilioClient: twilio.Twilio;
  private verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA_DUMMY_SID';
  private pepper = process.env.IDENTITY_PEPPER || process.env.JWT_SECRET || 'biblio-identity-pepper-secret-v7';

  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'AC_DUMMY',
      process.env.TWILIO_AUTH_TOKEN || 'DUMMY_TOKEN'
    );
  }

  /**
   * Normalizes any input phone number to canonical E.164 MSISDN format.
   * Handles local Nigerian prefixes (080..., 234..., +234...) and international numbers.
   */
  public normalizePhoneNumber(phone: string): string {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9+]/g, "").trim();
    if (cleaned.startsWith("0") && cleaned.length === 11) {
      cleaned = "+234" + cleaned.slice(1);
    } else if (cleaned.startsWith("234") && !cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    } else if (/^[789][01]\d{8}$/.test(cleaned)) {
      // 10-digit Nigerian mobile without leading zero
      cleaned = "+234" + cleaned;
    } else if (!cleaned.startsWith("+") && cleaned.length > 0) {
      cleaned = "+" + cleaned;
    }
    return cleaned;
  }

  /**
   * Generates a deterministic HMAC-SHA256 hash using the secret pepper.
   * Phone numbers are strictly normalized first to avoid divergent hashes.
   */
  public hashPhone(phone: string): string {
    const normalized = this.normalizePhoneNumber(phone);
    return crypto.createHmac('sha256', this.pepper).update(normalized).digest('hex');
  }

  /**
   * Dispatches a Twilio Verify SMS to the provided phone number.
   */
  public async sendOTP(phoneNumber: string): Promise<boolean> {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      if (this.verifyServiceSid === 'VA_DUMMY_SID') {
        logger.log(`[TwilioStub] Sending mock OTP to ${normalized}`);
        return true;
      }

      await this.twilioClient.verify.v2.services(this.verifyServiceSid)
        .verifications.create({ to: normalized, channel: 'sms' });
      return true;
    } catch (e: any) {
      logger.error(`[IdentityEngine] Failed to send OTP: ${e.message}`);
      return false;
    }
  }

  /**
   * Verifies the OTP and issues/returns a Global Buyer ID if successful.
   */
  public async verifyOTP(phoneNumber: string, code: string, merchantId: string, knownName?: string): Promise<string | null> {
    try {
      const normalized = this.normalizePhoneNumber(phoneNumber);
      if (this.verifyServiceSid === 'VA_DUMMY_SID' && code !== '123456') {
        return null;
      } else if (this.verifyServiceSid !== 'VA_DUMMY_SID') {
        const verification = await this.twilioClient.verify.v2.services(this.verifyServiceSid)
          .verificationChecks.create({ to: normalized, code });
        
        if (verification.status !== 'approved') {
          return null;
        }
      }

      return this.resolveBuyerIdentity(normalized, merchantId, knownName);
    } catch (e: any) {
      logger.error(`[IdentityEngine] Failed to verify OTP: ${e.message}`);
      return null;
    }
  }

  /**
   * Resolves a phone number to a Global Buyer ID with atomic upsert and tenant link.
   * Guarantees identical Global Buyer ID across merchants for matching normalized MSISDNs.
   */
  public async resolveBuyerIdentity(phoneNumber: string, merchantId: string, knownName?: string): Promise<string> {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    const phoneHash = this.hashPhone(normalized);
    
    // Check existing
    const existing = await sql<{ global_buyer_id: string }[]>`
      SELECT global_buyer_id 
      FROM customers 
      WHERE phone_hash = ${phoneHash}
      LIMIT 1
    `;

    let globalId: string;
    if (existing.length > 0) {
      globalId = existing[0].global_buyer_id;
    } else {
      const newGlobalId = crypto.randomUUID();
      const inserted = await sql<{ global_buyer_id: string }[]>`
        INSERT INTO customers (global_buyer_id, phone_hash, verified_profile, tier, cross_merchant_history)
        VALUES (
          ${newGlobalId}::uuid, 
          ${phoneHash}, 
          ${sql.json({ name: knownName || null })}, 
          'new', 
          ${sql.json([])}
        )
        ON CONFLICT (phone_hash) DO UPDATE SET updated_at = NOW()
        RETURNING global_buyer_id
      `;
      globalId = inserted[0]?.global_buyer_id ?? newGlobalId;

      await dataIntelligence.auditLog({
        service: 'identity-resolution',
        merchantId,
        action: 'buyer_id_provisioned',
        metadata: { globalBuyerId: globalId }
      }).catch(() => {});
    }

    // Link customer to merchant in customer_merchant_links
    const isMerchantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
    if (isMerchantUuid) {
      await sql`
        INSERT INTO customer_merchant_links (customer_id, merchant_id)
        VALUES (${normalized}, ${merchantId}::uuid)
        ON CONFLICT DO NOTHING
      `.catch(() => {});
    }

    return globalId;
  }

  /**
   * Retrieves unified customer profile for one-tap checkout.
   */
  public async getProfile(globalBuyerId: string): Promise<CustomerProfile | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(globalBuyerId);
    if (!isUuid) return null;

    const rows = await sql<{
      global_buyer_id: string;
      phone_hash: string;
      verified_profile: any;
      cross_merchant_history: any;
      tier: string;
      created_at: string;
    }[]>`
      SELECT global_buyer_id, phone_hash, verified_profile, cross_merchant_history, tier, created_at
      FROM customers
      WHERE global_buyer_id = ${globalBuyerId}::uuid
      LIMIT 1
    `.catch(() => []);

    if (rows.length === 0) return null;
    const r = rows[0];
    const vp = typeof r.verified_profile === 'string' ? JSON.parse(r.verified_profile) : (r.verified_profile || {});
    const cmh = typeof r.cross_merchant_history === 'string' ? JSON.parse(r.cross_merchant_history) : (r.cross_merchant_history || []);

    return {
      globalBuyerId: r.global_buyer_id,
      phoneHash: r.phone_hash,
      name: vp.name ?? undefined,
      deliveryAddress: vp.deliveryAddress ?? undefined,
      crossMerchantOrderCount: Array.isArray(cmh) ? cmh.length : 0,
      tier: r.tier,
      createdAt: new Date(r.created_at).getTime(),
    };
  }

  /**
   * Updates customer profile details (e.g. shipping address, name).
   */
  public async updateVerifiedProfile(
    globalBuyerId: string, 
    profileUpdates: { name?: string; deliveryAddress?: string; email?: string; defaultPaymentMethod?: string }
  ): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(globalBuyerId);
    if (!isUuid) return;

    const existing = await sql<{ verified_profile: any }[]>`
      SELECT verified_profile FROM customers WHERE global_buyer_id = ${globalBuyerId}::uuid
    `;
    if (existing.length === 0) return;

    let current: any = {};
    const raw = existing[0].verified_profile;
    if (typeof raw === 'string') {
      try { current = JSON.parse(raw); } catch {}
    } else if (raw && typeof raw === 'object') {
      current = raw;
    }

    const merged = { ...current, ...profileUpdates };

    await sql`
      UPDATE customers
      SET 
        verified_profile = ${sql.json(merged)},
        updated_at = NOW()
      WHERE global_buyer_id = ${globalBuyerId}::uuid
    `;
  }

  /**
   * Appends an order summary to the customer's cross-merchant history
   * and automatically updates customer tier based on loyalty progression.
   */
  public async recordCrossMerchantOrder(
    globalBuyerId: string,
    merchantId: string,
    orderSummary: { orderId: string; amount: number; currency: string }
  ): Promise<void> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(globalBuyerId);
    if (!isUuid) return;

    const entry = {
      orderId: orderSummary.orderId,
      merchantId,
      amount: orderSummary.amount,
      currency: orderSummary.currency,
      timestamp: Date.now()
    };

    const rows = await sql<{ cross_merchant_history: any }[]>`
      SELECT cross_merchant_history FROM customers
      WHERE global_buyer_id = ${globalBuyerId}::uuid
    `;
    if (rows.length === 0) return;

    let history: any[] = [];
    const raw = rows[0].cross_merchant_history;
    if (Array.isArray(raw)) history = raw;
    else if (typeof raw === 'string') {
      try { history = JSON.parse(raw); } catch { history = []; }
    }
    history.push(entry);

    // Dynamic RFM / Tier calculation
    const orderCount = history.length;
    const totalSpend = history.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);

    let newTier = 'new';
    if (orderCount >= 5 || totalSpend >= 20000000) {
      newTier = 'vip';
    } else if (orderCount >= 2) {
      newTier = 'regular';
    }

    await sql`
      UPDATE customers
      SET 
        cross_merchant_history = ${sql.json(history)},
        tier = ${newTier},
        updated_at = NOW()
      WHERE global_buyer_id = ${globalBuyerId}::uuid
    `;
  }

  /**
   * Enforces tenant isolation: Returns only customers who have interacted with this merchant.
   */
  public async getMerchantCustomers(merchantId: string): Promise<{ customerId: string; createdAt: Date }[]> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
    if (!isUuid) return [];

    const rows = await sql<{ customer_id: string; created_at: string }[]>`
      SELECT customer_id, created_at
      FROM customer_merchant_links
      WHERE merchant_id = ${merchantId}::uuid
      ORDER BY created_at DESC
    `;
    return rows.map(r => ({ customerId: r.customer_id, createdAt: new Date(r.created_at) }));
  }

  /**
   * Verifies whether a merchant has legitimate access to interact with or query a customer.
   * Protects against customer list poaching / unauthorized lookups.
   */
  public async canMerchantAccessCustomer(merchantId: string, customerPhone: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantId);
    if (!isUuid) return false;
    const normalized = this.normalizePhoneNumber(customerPhone);
    const rows = await sql<{ customer_id: string }[]>`
      SELECT customer_id FROM customer_merchant_links
      WHERE merchant_id = ${merchantId}::uuid AND (customer_id = ${customerPhone} OR customer_id = ${normalized})
      LIMIT 1
    `;
    return rows.length > 0;
  }
}

export const identityEngine = new IdentityResolutionEngine();
