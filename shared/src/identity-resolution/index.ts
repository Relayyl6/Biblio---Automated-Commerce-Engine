// shared/src/identity-resolution/index.ts
//
// Role: Global Buyer ID Engine
// Centralized service for tracking customer profiles across multiple merchants.
// Replaces the basic phone-number identifier with a unified cross-platform identity,
// enabling the 'one-tap checkout' network effect moat.

import { sql } from '../clients.js';
import { dataIntelligence } from '../data-intelligence/engine.js';
import twilio from 'twilio';

export interface CustomerProfile {
  globalBuyerId: string;
  phoneHash: string;
  name?: string;
  deliveryAddress?: string;
  crossMerchantOrderCount: number;
  createdAt: number;
}

export class IdentityResolutionEngine {
  
  private twilioClient: twilio.Twilio;
  private verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || 'VA_DUMMY_SID';

  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'AC_DUMMY',
      process.env.TWILIO_AUTH_TOKEN || 'DUMMY_TOKEN'
    );
  }

  /**
   * Dispatches a Twilio Verify SMS to the provided phone number.
   */
  public async sendOTP(phoneNumber: string): Promise<boolean> {
    try {
      // In dev mode without real creds, skip Twilio call
      if (this.verifyServiceSid === 'VA_DUMMY_SID') {
        console.log(`[TwilioStub] Sending mock OTP to ${phoneNumber}`);
        return true;
      }

      await this.twilioClient.verify.v2.services(this.verifyServiceSid)
        .verifications.create({ to: phoneNumber, channel: 'sms' });
      return true;
    } catch (e: any) {
      console.error(`[IdentityEngine] Failed to send OTP: ${e.message}`);
      return false;
    }
  }

  /**
   * Verifies the OTP and issues a Global Buyer ID if successful.
   */
  public async verifyOTP(phoneNumber: string, code: string, merchantId: string, knownName?: string): Promise<string | null> {
    try {
      // In dev mode without real creds, accept '123456' as valid
      if (this.verifyServiceSid === 'VA_DUMMY_SID' && code !== '123456') {
        return null;
      } else if (this.verifyServiceSid !== 'VA_DUMMY_SID') {
        const verification = await this.twilioClient.verify.v2.services(this.verifyServiceSid)
          .verificationChecks.create({ to: phoneNumber, code });
        
        if (verification.status !== 'approved') {
          return null;
        }
      }

      return this.resolveBuyerIdentity(phoneNumber, merchantId, knownName);
    } catch (e: any) {
      console.error(`[IdentityEngine] Failed to verify OTP: ${e.message}`);
      return null;
    }
  }

  /**
   * Resolves a WhatsApp phone number to a Global Buyer ID.
   * Creates a new profile if one doesn't exist.
   */
  private async resolveBuyerIdentity(phoneNumber: string, merchantId: string, knownName?: string): Promise<string> {
    // Basic hash to anonymize phone numbers in the global scope while remaining deterministic
    const phoneHash = this.hashPhone(phoneNumber);
    
    const existing = await sql<{ global_buyer_id: string }[]>`
      SELECT global_buyer_id 
      FROM customers 
      WHERE phone_hash = ${phoneHash}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return existing[0].global_buyer_id;
    }

    // Provision new Global Buyer ID
    const newGlobalId = crypto.randomUUID();
    
    await sql`
      INSERT INTO customers (global_buyer_id, phone_hash, verified_profile, tier, cross_merchant_history)
      VALUES (
        ${newGlobalId}, 
        ${phoneHash}, 
        ${JSON.stringify({ name: knownName || null })}, 
        'new', 
        ${JSON.stringify([])}
      )
    `;

    await dataIntelligence.auditLog({
      service: 'identity-resolution',
      merchantId,
      action: 'buyer_id_provisioned',
      metadata: { globalBuyerId: newGlobalId }
    });

    return newGlobalId;
  }

  private hashPhone(phone: string): string {
    // Stub hash function. In production, use standard SHA-256 with pepper.
    return Buffer.from(`ace-salt-${phone}`).toString('base64');
  }
}

export const identityEngine = new IdentityResolutionEngine();
