import { sql } from "@ace/shared/clients";

export type ChatClass = 'business' | 'personal' | 'uncertain';

export interface ClassificationResult {
  classification: ChatClass;
  confidence: number;
  reasons: string[];
  vendorOverride?: 'business' | 'personal' | 'ignore';
  isSoftMode: boolean;
  canAutoReply: boolean;
}

export class ChatClassifier {
  private static COMMERCIAL_KEYWORDS = [
    'price', 'how much', 'cost', 'available', 'order', 'stock', 'pay', 'account',
    'bank', 'transfer', 'delivery', 'deliver', 'size', 'colour', 'color', 'ankara',
    'buy', 'invoice', 'discount', 'last price', 'sef', 'catalog', 'catalogue'
  ];

  private static PERSONAL_KEYWORDS = [
    'mom', 'dad', 'babe', 'bro', 'sis', 'dinner', 'lunch', 'family', 'church',
    'school', 'house', 'weekend', 'love you', 'sweetheart', 'darling', 'honey'
  ];

  /**
   * Classify an inbound message or thread
   */
  static async classifyChat(
    merchantId: string,
    chatId: string,
    messageText: string,
    senderPhone?: string
  ): Promise<ClassificationResult> {
    // 1. Check existing classification record / vendor override
    const existing = await sql<any[]>`
      SELECT classification, confidence, reasons, vendor_override
      FROM chat_classifications
      WHERE merchant_id = ${merchantId}::uuid AND chat_id = ${chatId}
    `;

    if (existing.length > 0 && existing[0].vendor_override) {
      const override = existing[0].vendor_override;
      if (override === 'personal' || override === 'ignore') {
        return {
          classification: 'personal',
          confidence: 1.0,
          reasons: [`Vendor explicit override: ${override}`],
          vendorOverride: override,
          isSoftMode: false,
          canAutoReply: false
        };
      }
      if (override === 'business') {
        return {
          classification: 'business',
          confidence: 1.0,
          reasons: ['Vendor explicit override: marked as business'],
          vendorOverride: 'business',
          isSoftMode: false,
          canAutoReply: true
        };
      }
    }

    // 2. Perform heuristic & intent scoring
    const textLower = (messageText || '').toLowerCase();
    const commercialHits = this.COMMERCIAL_KEYWORDS.filter(kw => textLower.includes(kw));
    const personalHits = this.PERSONAL_KEYWORDS.filter(kw => textLower.includes(kw));

    let classification: ChatClass = 'uncertain';
    let confidence = 0.5;
    const reasons: string[] = [];

    if (commercialHits.length > 0 && personalHits.length === 0) {
      classification = 'business';
      confidence = Math.min(0.95, 0.65 + commercialHits.length * 0.1);
      reasons.push(`Commercial vocabulary detected: ${commercialHits.join(', ')}`);
    } else if (personalHits.length > 0 && commercialHits.length === 0) {
      classification = 'personal';
      confidence = Math.min(0.95, 0.65 + personalHits.length * 0.1);
      reasons.push(`Personal/familial markers detected: ${personalHits.join(', ')}`);
    } else if (commercialHits.length > 0 && personalHits.length > 0) {
      classification = 'uncertain';
      confidence = 0.5;
      reasons.push(`Mixed commercial and personal markers detected.`);
    } else {
      classification = 'uncertain';
      confidence = 0.4;
      reasons.push('Insufficient signals for definitive classification.');
    }

    // 3. Upsert classification record
    await sql`
      INSERT INTO chat_classifications (merchant_id, chat_id, customer_id, classification, confidence, reasons, updated_at)
      VALUES (${merchantId}::uuid, ${chatId}, ${senderPhone || chatId}, ${classification}, ${confidence}, ${JSON.stringify(reasons)}::jsonb, NOW())
      ON CONFLICT (merchant_id, chat_id) DO UPDATE SET
        classification = EXCLUDED.classification,
        confidence = EXCLUDED.confidence,
        reasons = EXCLUDED.reasons,
        updated_at = NOW()
    `;

    // 4. If uncertain, add message to short-TTL quarantine (24h)
    if (classification === 'uncertain') {
      await sql`
        INSERT INTO chat_quarantine (merchant_id, chat_id, message_id, content, sender_phone, status, expires_at)
        VALUES (
          ${merchantId}::uuid,
          ${chatId},
          ${'msg_' + Date.now()},
          ${messageText},
          ${senderPhone || null},
          'quarantined',
          NOW() + INTERVAL '24 hours'
        )
      `;
    }

    const isSoftMode = classification === 'uncertain';
    const canAutoReply = classification === 'business';

    return {
      classification,
      confidence,
      reasons,
      vendorOverride: existing[0]?.vendor_override,
      isSoftMode,
      canAutoReply
    };
  }

  /**
   * Set vendor resolution (Business / Personal / Ignore)
   */
  static async resolveChat(
    merchantId: string,
    chatId: string,
    resolution: 'business' | 'personal' | 'ignore'
  ): Promise<void> {
    const classification: ChatClass = resolution === 'business' ? 'business' : 'personal';

    await sql`
      INSERT INTO chat_classifications (merchant_id, chat_id, classification, confidence, vendor_override, reasons, updated_at)
      VALUES (
        ${merchantId}::uuid,
        ${chatId},
        ${classification},
        1.0,
        ${resolution},
        ${JSON.stringify([`Vendor manual resolution: ${resolution}`])}::jsonb,
        NOW()
      )
      ON CONFLICT (merchant_id, chat_id) DO UPDATE SET
        classification = EXCLUDED.classification,
        confidence = 1.0,
        vendor_override = ${resolution},
        updated_at = NOW()
    `;

    // If marked personal or ignore, flush any quarantined messages immediately per privacy policy
    if (resolution === 'personal' || resolution === 'ignore') {
      await sql`
        DELETE FROM chat_quarantine
        WHERE merchant_id = ${merchantId}::uuid AND chat_id = ${chatId}
      `;
    } else {
      // Mark quarantined as approved
      await sql`
        UPDATE chat_quarantine
        SET status = 'approved'
        WHERE merchant_id = ${merchantId}::uuid AND chat_id = ${chatId}
      `;
    }
  }

  /**
   * List pending quarantined chats awaiting vendor prompt
   */
  static async getQuarantinedChats(merchantId: string): Promise<any[]> {
    return sql`
      SELECT q.id, q.chat_id, q.content, q.sender_phone, q.expires_at, q.created_at,
             c.confidence, c.reasons
      FROM chat_quarantine q
      LEFT JOIN chat_classifications c ON c.merchant_id = q.merchant_id AND c.chat_id = q.chat_id
      WHERE q.merchant_id = ${merchantId}::uuid AND q.status = 'quarantined' AND q.expires_at > NOW()
      ORDER BY q.created_at DESC
      LIMIT 20
    `;
  }
}
