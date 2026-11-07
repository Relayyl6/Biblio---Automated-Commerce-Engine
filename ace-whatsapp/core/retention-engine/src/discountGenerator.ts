import { sql } from '@ace/shared/clients.js';
import { AtRiskCustomer, WinbackDraft, PricingRule } from './types.js';
import { logger } from '@ace/shared/logger.js';

export class DiscountGenerator {
  async draftWinback(customer: AtRiskCustomer): Promise<WinbackDraft | null> {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customer.merchantId);
      const ruleRows = isUuid ? await sql<any[]>`
        SELECT max_discount_by_tier, winback_discounts_enabled
        FROM merchant_pricing_rules 
        WHERE merchant_id = ${customer.merchantId}::uuid 
        LIMIT 1
      `.catch(() => []) : [];
      
      const discountsEnabled = ruleRows.length > 0 && ruleRows[0].winback_discounts_enabled !== null 
        ? Boolean(ruleRows[0].winback_discounts_enabled) 
        : true;

      let messageDraft = `Hello!\n\nWe haven't seen you in a while and just wanted to check in. Let us know if you need anything from our catalog!`;
      let proposedDiscount = 0;

      if (discountsEnabled) {
        let maxDiscountPercent = 15;
        if (ruleRows.length > 0 && ruleRows[0].max_discount_by_tier) {
          const tiers = typeof ruleRows[0].max_discount_by_tier === 'string'
            ? JSON.parse(ruleRows[0].max_discount_by_tier)
            : ruleRows[0].max_discount_by_tier;
          
          const vipVal = tiers.vip ?? tiers.loyal ?? 0.15;
          maxDiscountPercent = vipVal <= 1 ? Math.round(vipVal * 100) : Math.round(vipVal);
        }
        
        proposedDiscount = customer.lifetimeValue > 100000 ? maxDiscountPercent : Math.min(5, maxDiscountPercent);
        proposedDiscount = Math.floor(proposedDiscount); 
        
        if (proposedDiscount > 0) {
          messageDraft = `Hello!\n\nWe haven't seen you in a while! As one of our favorite customers, we'd love to offer you ${proposedDiscount}% off your next order.\n\nJust reply to this message to claim it!`;
        }
      }

      const draftId = `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      if (isUuid) {
        await sql`
          INSERT INTO winback_drafts (id, merchant_id, customer_id, proposed_discount_percent, message_draft, status, created_at)
          VALUES (${draftId}, ${customer.merchantId}::uuid, ${customer.customerId}, ${proposedDiscount}, ${messageDraft}, 'pending_approval', NOW())
        `;
      }

      logger.log('Generated winback discount draft', { draftId, customerId: customer.customerId, discount: proposedDiscount });

      return {
        id: draftId,
        merchantId: customer.merchantId,
        customerId: customer.customerId,
        proposedDiscountPercent: proposedDiscount,
        messageDraft,
        status: 'pending_approval',
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      logger.error('Failed to draft winback message', { err, customerId: customer.customerId });
      return null;
    }
  }
}
