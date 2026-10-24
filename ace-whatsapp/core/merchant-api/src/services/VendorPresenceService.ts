import { sql } from "@ace/shared/clients";

export type PresenceState = 'present' | 'delayed' | 'away' | 'off';

export interface PresenceInfo {
  state: PresenceState;
  sla_minutes: number;
  read_grace_minutes: number;
  cover_me: boolean;
  last_active_at: string;
  context_summary?: string;
}

export class VendorPresenceService {
  /**
   * Get current presence state for a merchant
   */
  static async getPresence(merchantId: string): Promise<PresenceInfo> {
    const rows = await sql<PresenceInfo[]>`
      SELECT state, sla_minutes, read_grace_minutes, cover_me, last_active_at, context_summary
      FROM vendor_presence
      WHERE merchant_id = ${merchantId}::uuid
    `;

    if (rows.length === 0) {
      // Default initial presence
      await sql`
        INSERT INTO vendor_presence (merchant_id, state, sla_minutes, read_grace_minutes, cover_me, last_active_at)
        VALUES (${merchantId}::uuid, 'present', 10, 5, false, NOW())
        ON CONFLICT (merchant_id) DO NOTHING
      `;
      return {
        state: 'present',
        sla_minutes: 10,
        read_grace_minutes: 5,
        cover_me: false,
        last_active_at: new Date().toISOString()
      };
    }

    return rows[0];
  }

  /**
   * Update presence configuration and status
   */
  static async updatePresence(merchantId: string, updates: Partial<PresenceInfo>): Promise<PresenceInfo> {
    const current = await this.getPresence(merchantId);
    const state = updates.state ?? current.state;
    const sla = updates.sla_minutes ?? current.sla_minutes;
    const readGrace = updates.read_grace_minutes ?? current.read_grace_minutes;
    const coverMe = updates.cover_me ?? current.cover_me;
    const summary = updates.context_summary ?? current.context_summary ?? null;

    const rows = await sql<PresenceInfo[]>`
      INSERT INTO vendor_presence (merchant_id, state, sla_minutes, read_grace_minutes, cover_me, context_summary, last_active_at, updated_at)
      VALUES (${merchantId}::uuid, ${state}, ${sla}, ${readGrace}, ${coverMe}, ${summary}, NOW(), NOW())
      ON CONFLICT (merchant_id) DO UPDATE SET
        state = EXCLUDED.state,
        sla_minutes = EXCLUDED.sla_minutes,
        read_grace_minutes = EXCLUDED.read_grace_minutes,
        cover_me = EXCLUDED.cover_me,
        context_summary = COALESCE(EXCLUDED.context_summary, vendor_presence.context_summary),
        last_active_at = NOW(),
        updated_at = NOW()
      RETURNING state, sla_minutes, read_grace_minutes, cover_me, last_active_at, context_summary
    `;

    return rows[0];
  }

  /**
   * One-tap 'Cover me': instant Biblio duty globally or per chat
   */
  static async setCoverMe(merchantId: string, enabled: boolean): Promise<PresenceInfo> {
    return this.updatePresence(merchantId, {
      cover_me: enabled,
      state: enabled ? 'away' : 'present'
    });
  }

  /**
   * Check if Biblio should yield to the vendor for a specific chat.
   * Biblio yields if:
   * 1. The vendor has hands_off enabled for this chat.
   * 2. The vendor is active ('present') and within the SLA window.
   * 3. Vendor read-without-reply is still inside the read grace window.
   */
  static async shouldBiblioYield(merchantId: string, chatId: string): Promise<{ yield: boolean; reason: string }> {
    // 1. Check hands-off override
    const override = await sql<{ hands_off: boolean }[]>`
      SELECT hands_off FROM chat_overrides
      WHERE merchant_id = ${merchantId}::uuid AND chat_id = ${chatId}
    `;

    if (override.length > 0 && override[0].hands_off) {
      return { yield: true, reason: 'Chat is marked Hands-Off by vendor.' };
    }

    // 2. Check vendor presence
    const presence = await this.getPresence(merchantId);
    if (presence.cover_me) {
      return { yield: false, reason: 'Cover-me active: Biblio replies immediately.' };
    }

    if (presence.state === 'off') {
      return { yield: true, reason: 'Biblio is paused globally by vendor.' };
    }

    if (presence.state === 'away') {
      return { yield: false, reason: 'Vendor is away: Biblio handles conversation.' };
    }

    // In 'present' or 'delayed' mode, check SLA vs last customer message
    return { yield: false, reason: 'SLA elapsed or autonomy conditions met.' };
  }

  /**
   * Set 'hands off' per-chat silence
   */
  static async setHandsOff(merchantId: string, chatId: string, handsOff: boolean): Promise<boolean> {
    await sql`
      INSERT INTO chat_overrides (merchant_id, chat_id, hands_off, updated_at)
      VALUES (${merchantId}::uuid, ${chatId}, ${handsOff}, NOW())
      ON CONFLICT (merchant_id, chat_id) DO UPDATE SET
        hands_off = ${handsOff},
        updated_at = NOW()
    `;
    return handsOff;
  }

  /**
   * Handback context passing: on takeover or resumption, summarize context
   */
  static async recordHandback(merchantId: string, chatId: string, direction: 'to_vendor' | 'to_biblio', summary: string): Promise<void> {
    await sql`
      UPDATE vendor_presence
      SET context_summary = ${summary}, updated_at = NOW()
      WHERE merchant_id = ${merchantId}::uuid
    `;

    // Also record audit log entry
    await sql`
      INSERT INTO veto_audit_logs (merchant_id, chat_id, action_type, blocked_by, reason, payload)
      VALUES (
        ${merchantId}::uuid,
        ${chatId},
        ${direction === 'to_vendor' ? 'live_barge_in' : 'reply_review'},
        'operator',
        ${summary},
        ${JSON.stringify({ direction, timestamp: new Date().toISOString() })}::jsonb
      )
    `;
  }
}
