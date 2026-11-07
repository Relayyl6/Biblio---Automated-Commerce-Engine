import { sql, redis } from "@ace/shared/clients";

export type PresenceState = 'present' | 'delayed' | 'away' | 'off';

export interface PresenceInfo {
  state: PresenceState;
  sla_minutes: number;
  read_grace_minutes: number;
  cover_me: boolean;
  last_active_at: string;
  context_summary?: string;
}

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export class VendorPresenceService {
  /**
   * Get current presence state for a merchant
   */
  static async getPresence(merchantId: string): Promise<PresenceInfo> {
    if (!merchantId || !isUuid(merchantId)) {
      throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
    }

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
      const def: PresenceInfo = {
        state: 'present',
        sla_minutes: 10,
        read_grace_minutes: 5,
        cover_me: false,
        last_active_at: new Date().toISOString()
      };
      await redis.set(`vendor:presence:${merchantId}`, JSON.stringify(def)).catch(() => {});
      return def;
    }

    await redis.set(`vendor:presence:${merchantId}`, JSON.stringify(rows[0])).catch(() => {});
    return rows[0];
  }

  /**
   * Update presence configuration and status
   */
  static async updatePresence(merchantId: string, updates: Partial<PresenceInfo>): Promise<PresenceInfo> {
    if (!merchantId || !isUuid(merchantId)) {
      throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
    }

    const validStates: PresenceState[] = ['present', 'delayed', 'away', 'off'];
    if (updates.state !== undefined && !validStates.includes(updates.state)) {
      throw new Error(`Invalid presence state: must be one of 'present', 'delayed', 'away', 'off'`);
    }

    if (updates.sla_minutes !== undefined && (typeof updates.sla_minutes !== 'number' || !Number.isFinite(updates.sla_minutes) || updates.sla_minutes < 0)) {
      throw new Error("Invalid sla_minutes: must be a non-negative number");
    }

    if (updates.read_grace_minutes !== undefined && (typeof updates.read_grace_minutes !== 'number' || !Number.isFinite(updates.read_grace_minutes) || updates.read_grace_minutes < 0)) {
      throw new Error("Invalid read_grace_minutes: must be a non-negative number");
    }

    if (updates.cover_me !== undefined && typeof updates.cover_me !== 'boolean') {
      throw new Error("Invalid cover_me: must be a boolean");
    }

    const hasState = updates.state !== undefined;
    const hasSla = typeof updates.sla_minutes === 'number';
    const hasReadGrace = typeof updates.read_grace_minutes === 'number';
    const hasCoverMe = typeof updates.cover_me === 'boolean';
    const hasSummary = updates.context_summary !== undefined;

    const summaryVal = updates.context_summary ?? null;

    const rows = (await sql`
      INSERT INTO vendor_presence (merchant_id, state, sla_minutes, read_grace_minutes, cover_me, context_summary, last_active_at, updated_at)
      VALUES (
        ${merchantId}::uuid,
        ${hasState ? updates.state! : 'present'},
        ${hasSla ? Math.max(0, Math.floor(updates.sla_minutes!)) : 10},
        ${hasReadGrace ? Math.max(0, Math.floor(updates.read_grace_minutes!)) : 5},
        ${hasCoverMe ? updates.cover_me! : false},
        ${summaryVal},
        NOW(),
        NOW()
      )
      ON CONFLICT (merchant_id) DO UPDATE SET
        state = CASE WHEN ${hasState} THEN EXCLUDED.state ELSE vendor_presence.state END,
        sla_minutes = CASE WHEN ${hasSla} THEN EXCLUDED.sla_minutes ELSE vendor_presence.sla_minutes END,
        read_grace_minutes = CASE WHEN ${hasReadGrace} THEN EXCLUDED.read_grace_minutes ELSE vendor_presence.read_grace_minutes END,
        cover_me = CASE WHEN ${hasCoverMe} THEN EXCLUDED.cover_me ELSE vendor_presence.cover_me END,
        context_summary = CASE WHEN ${hasSummary} THEN EXCLUDED.context_summary ELSE vendor_presence.context_summary END,
        last_active_at = NOW(),
        updated_at = NOW()
      RETURNING state, sla_minutes, read_grace_minutes, cover_me, last_active_at, context_summary
    `) as unknown as PresenceInfo[];

    const updated = rows[0];

    // Synchronize to Redis Single Source of Truth
    try {
      if (updated.state === 'off') {
        await redis.set(`killswitch:global:${merchantId}`, "1");
      } else {
        await redis.del(`killswitch:global:${merchantId}`);
      }

      if (updated.cover_me) {
        await redis.set(`vendor:cover_me:${merchantId}`, "1");
      } else {
        await redis.del(`vendor:cover_me:${merchantId}`);
      }

      await redis.set(`vendor:presence:${merchantId}`, JSON.stringify(updated));
    } catch (_) {}

    return updated;
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
   * 1. The vendor has hands_off enabled for this chat or human takeover is active.
   * 2. The vendor is active ('present') and within the SLA window.
   * 3. Vendor read-without-reply is still inside the read grace window.
   */
  static async shouldBiblioYield(merchantId: string, chatId: string): Promise<{ yield: boolean; reason: string }> {
    if (!merchantId || !isUuid(merchantId)) {
      throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
    }

    // 1. Check hands-off override from Redis (killswitch & human_override) and Database
    const cachedHandsOff = await redis.get(`killswitch:chat:${merchantId}:${chatId}`).catch(() => null);
    const cachedHumanOverride = await redis.get(`human_override:${chatId}`).catch(() => null);
    if (cachedHandsOff || cachedHumanOverride) {
      return { yield: true, reason: 'Chat is marked Hands-Off / Human Override active.' };
    }

    const override = await sql<{ hands_off: boolean }[]>`
      SELECT hands_off FROM chat_overrides
      WHERE merchant_id = ${merchantId}::uuid AND chat_id = ${chatId}
    `;

    if (override.length > 0 && override[0].hands_off) {
      await redis.set(`killswitch:chat:${merchantId}:${chatId}`, "1").catch(() => {});
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
    if (!merchantId || !isUuid(merchantId)) {
      throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
    }

    await sql`
      INSERT INTO chat_overrides (merchant_id, chat_id, hands_off, updated_at)
      VALUES (${merchantId}::uuid, ${chatId}, ${handsOff}, NOW())
      ON CONFLICT (merchant_id, chat_id) DO UPDATE SET
        hands_off = ${handsOff},
        updated_at = NOW()
    `;

    try {
      if (handsOff) {
        await redis.set(`killswitch:chat:${merchantId}:${chatId}`, "1");
        await redis.set(`human_override:${chatId}`, "1", "EX", 3600);
      } else {
        await redis.del(`killswitch:chat:${merchantId}:${chatId}`);
        await redis.del(`human_override:${chatId}`);
      }
    } catch (_) {}

    return handsOff;
  }

  /**
   * Handback context passing: on takeover or resumption, summarize context
   */
  static async recordHandback(merchantId: string, chatId: string, direction: 'to_vendor' | 'to_biblio', summary: string): Promise<void> {
    if (!merchantId || !isUuid(merchantId)) {
      throw new Error(`Invalid merchantId format: "${merchantId}" is not a valid UUID`);
    }

    if (!direction || !['to_vendor', 'to_biblio'].includes(direction)) {
      throw new Error(`Invalid direction: must be 'to_vendor' or 'to_biblio'`);
    }

    await sql`
      INSERT INTO vendor_presence (merchant_id, state, sla_minutes, read_grace_minutes, cover_me, context_summary, last_active_at, updated_at)
      VALUES (${merchantId}::uuid, 'present', 10, 5, false, ${summary || null}, NOW(), NOW())
      ON CONFLICT (merchant_id) DO UPDATE SET
        context_summary = EXCLUDED.context_summary,
        updated_at = NOW()
    `;

    // Also record audit log entry
    await sql`
      INSERT INTO veto_audit_logs (merchant_id, chat_id, action_type, blocked_by, reason, payload)
      VALUES (
        ${merchantId}::uuid,
        ${chatId},
        ${direction === 'to_vendor' ? 'live_barge_in' : 'reply_review'},
        'operator',
        ${summary || 'Handback recorded'},
        ${JSON.stringify({ direction, timestamp: new Date().toISOString() })}::jsonb
      )
    `;
  }
}
