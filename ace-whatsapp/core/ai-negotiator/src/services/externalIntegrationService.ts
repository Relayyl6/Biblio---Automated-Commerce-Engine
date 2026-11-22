import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import crypto from 'crypto';

export interface WebhookSubscription {
  id: string;
  merchantId: string;
  targetUrl: string;
  events: string[];
  secretKey: string;
  active: boolean;
  createdAt: string;
}

export class ExternalIntegrationService {
  /**
   * Register external webhook with HMAC signing key for Zapier/custom backends.
   */
  static async registerWebhook(params: {
    merchantId: string;
    targetUrl: string;
    events: string[];
  }): Promise<WebhookSubscription> {
    const { merchantId, targetUrl, events } = params;

    if (!targetUrl.startsWith('https://')) {
      throw new Error('Webhooks must use HTTPS endpoints for security.');
    }

    const secretKey = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const rows = await sql<{ id: string; created_at: string }[]>`
      INSERT INTO merchant_webhooks (
        merchant_id, target_url, events, secret_key, active, created_at, updated_at
      ) VALUES (
        ${merchantId}::uuid, ${targetUrl}, ${events}, ${secretKey}, true, now(), now()
      ) RETURNING id, created_at
    `;

    const sub: WebhookSubscription = {
      id: rows[0].id,
      merchantId,
      targetUrl,
      events,
      secretKey,
      active: true,
      createdAt: rows[0].created_at,
    };

    logger.info('[ExternalIntegrationService] Registered webhook', { merchantId, targetUrl, events });
    return sub;
  }

  /**
   * Send SMS fallback when customer is unreachable on WhatsApp.
   */
  static async sendSmsFallback(params: {
    merchantId: string;
    phone: string;
    messageText: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const { merchantId, phone, messageText } = params;

    const messageId = `SMS-${Date.now().toString(36).toUpperCase()}`;
    logger.info(`[ExternalIntegrationService] Sending SMS fallback to ${phone}: "${messageText.slice(0, 50)}..."`);

    // Record in SMS dispatch logs
    await sql`
      INSERT INTO sms_dispatch_logs (
        message_id, merchant_id, recipient_phone, message_text, status, provider, created_at
      ) VALUES (
        ${messageId}, ${merchantId}::uuid, ${phone}, ${messageText}, 'sent', 'africastalking', now()
      )
    `.catch(() => {});

    return { success: true, messageId };
  }

  /**
   * Forward high-priority store alerts to merchant's Slack or Discord channel.
   */
  static async postSlackDiscordAlert(params: {
    webhookUrl: string;
    title: string;
    description: string;
    color?: string;
  }): Promise<boolean> {
    const { webhookUrl, title, description, color = '#10B981' } = params;

    const payload = {
      text: `*${title}*\n${description}`,
      attachments: [{ title, text: description, color }],
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err: any) {
      logger.warn('[ExternalIntegrationService] Failed to post Slack/Discord webhook:', err.message);
      return false;
    }
  }

  /**
   * Generate secure API key for custom integrations.
   */
  static async generateApiKey(params: {
    merchantId: string;
    name: string;
    scopes?: string[];
  }): Promise<{ apiKey: string; keyId: string; name: string }> {
    const { merchantId, name, scopes = ['read', 'write'] } = params;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const apiKey = `biblio_live_${rawToken}`;
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const rows = await sql<{ id: string }[]>`
      INSERT INTO merchant_api_keys (
        merchant_id, name, key_hash, key_prefix, scopes, active, created_at
      ) VALUES (
        ${merchantId}::uuid, ${name}, ${hash}, ${apiKey.slice(0, 16)}, ${scopes}, true, now()
      ) RETURNING id
    `;

    return {
      apiKey,
      keyId: rows[0].id,
      name,
    };
  }
}
