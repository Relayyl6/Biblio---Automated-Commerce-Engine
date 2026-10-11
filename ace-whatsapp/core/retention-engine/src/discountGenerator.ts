import { sql } from '@ace/shared/clients.js';
import { AtRiskCustomer, WinbackDraft, PricingRule } from './types.js';
import { logger } from '@ace/shared/logger.js';

export class DiscountGenerator {
  async draftWinback(customer: AtRiskCustomer): Promise<WinbackDraft | null> {
    try {
      const ruleRows = await sql<any[]>`
        SELECT max_discount_percent, min_margin_percent, winback_discounts_enabled
        FROM merchant_pricing_rules 
        WHERE merchant_id = ${customer.merchantId} 
        LIMIT 1
      `;
      
      const discountsEnabled = ruleRows.length > 0 ? ruleRows[0].winback_discounts_enabled : false;
      let messageDraft = `Hello!\n\nWe haven't seen you in a while and just wanted to check in. Let us know if you need anything from our catalog!`;
      let proposedDiscount = 0;

      if (discountsEnabled) {
        const maxDiscount = ruleRows.length > 0 ? parseFloat(ruleRows[0].max_discount_percent) : 0;
        
        proposedDiscount = customer.lifetimeValue > 100000 ? maxDiscount : Math.min(5, maxDiscount);
        proposedDiscount = Math.floor(proposedDiscount); 
        
        if (proposedDiscount > 0) {
          messageDraft = `Hello!\n\nWe haven't seen you in a while! As one of our favorite customers, we'd love to offer you ${proposedDiscount}% off your next order.\n\nJust reply to this message to claim it!`;
        }
      }

      const draftId = `win_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      await sql`
        INSERT INTO winback_drafts (id, merchant_id, customer_id, proposed_discount_percent, message_draft, status, created_at)
        VALUES (${draftId}, ${customer.merchantId}, ${customer.customerId}, ${proposedDiscount}, ${messageDraft}, 'pending_approval', NOW())
      `;

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
