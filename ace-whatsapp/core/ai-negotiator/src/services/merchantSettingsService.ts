import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';

export interface BusinessProfile {
  merchantId: string;
  name: string;
  ownerName: string;
  phone: string;
  dialect: string;
  toneGuide: string;
  feePaddingModel: 'customer_padded' | 'merchant_absorbed' | 'split';
  platformFeePercent: number;
  operatingHours: any;
  businessAddress: any;
  returnPolicy: string;
  deliveryNotes: string;
  vacationMode: boolean;
  staffCount: number;
}

export class MerchantSettingsService {
  /**
   * Fetch complete business profile and system configuration.
   */
  static async getBusinessProfile(merchantId: string): Promise<BusinessProfile> {
    const rows = await sql<{
      id: string;
      name: string;
      owner_first_name: string;
      owner_last_name: string;
      phone: string;
      dialect: string;
      tone_guide: string;
      fee_padding_model: string;
      platform_fee_percent: number;
      operating_hours: any;
      physical_address: any;
      return_policy: string;
      delivery_notes: string;
      vacation_mode: boolean;
    }[]>`
      SELECT id, name, owner_first_name, owner_last_name, phone, dialect, tone_guide,
             fee_padding_model, platform_fee_percent, operating_hours, physical_address,
             return_policy, delivery_notes, COALESCE(vacation_mode, false) as vacation_mode
      FROM merchants
      WHERE id = ${merchantId}::uuid
      LIMIT 1
    `.catch(() => []);

    const m = rows[0] || {
      id: merchantId,
      name: 'Store',
      owner_first_name: 'Merchant',
      owner_last_name: '',
      phone: '',
      dialect: 'en',
      tone_guide: 'Warm and friendly Nigerian merchant',
      fee_padding_model: 'customer_padded',
      platform_fee_percent: 3.0,
      operating_hours: {},
      physical_address: {},
      return_policy: 'No refunds after delivery confirmation.',
      delivery_notes: 'Standard delivery via dispatch bike.',
      vacation_mode: false,
    };

    const staffCountRows = await sql<{ count: number }[]>`
      SELECT COUNT(id) as count FROM merchant_staff WHERE merchant_id = ${merchantId}::uuid AND active = true
    `.catch(() => [{ count: 1 }]);

    return {
      merchantId: m.id,
      name: m.name,
      ownerName: `${m.owner_first_name} ${m.owner_last_name}`.trim(),
      phone: m.phone || '',
      dialect: m.dialect || 'en',
      toneGuide: m.tone_guide || 'Warm, professional Nigerian trader',
      feePaddingModel: (m.fee_padding_model as any) || 'customer_padded',
      platformFeePercent: Number(m.platform_fee_percent || 3.0),
      operatingHours: m.operating_hours || {},
      businessAddress: m.physical_address || {},
      returnPolicy: m.return_policy || 'No returns after delivery.',
      deliveryNotes: m.delivery_notes || 'Standard dispatch bike delivery.',
      vacationMode: !!m.vacation_mode,
      staffCount: Number(staffCountRows[0]?.count || 1),
    };
  }

  /**
   * Configure store operating hours (e.g. Mon-Sat 08:30 to 18:30).
   */
  static async updateStoreHours(merchantId: string, hours: Record<string, { open: string; close: string; closed?: boolean }>): Promise<boolean> {
    await sql`
      UPDATE merchants
      SET operating_hours = ${jsonb(hours)}, updated_at = now()
      WHERE id = ${merchantId}::uuid
    `;
    logger.info('[MerchantSettingsService] Updated store hours', { merchantId });
    return true;
  }

  /**
   * Update return policies, delivery rules, or customer guarantees.
   */
  static async updateStorePolicy(params: {
    merchantId: string;
    returnPolicy?: string;
    deliveryNotes?: string;
    deliveryInfo?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { merchantId, returnPolicy, deliveryNotes, deliveryInfo } = params;

    await sql`
      UPDATE merchants
      SET return_policy = COALESCE(${returnPolicy || null}, return_policy),
          delivery_notes = COALESCE(${deliveryNotes || null}, delivery_notes),
          delivery_info = COALESCE(${deliveryInfo || null}, delivery_info),
          updated_at = now()
      WHERE id = ${merchantId}::uuid
    `;

    return { success: true, message: 'Store policies updated successfully.' };
  }

  /**
   * Toggle store vacation / away mode with custom automatic responder message.
   */
  static async toggleVacationMode(
    merchantId: string,
    enabled: boolean,
    autoReplyMessage?: string
  ): Promise<{ success: boolean; vacationMode: boolean; message: string }> {
    const defaultMsg = "Hi there! Our shop is currently on a short break. You can still browse our catalog and leave an order—we'll attend to it first thing when we return!";
    const finalMsg = autoReplyMessage || defaultMsg;

    await sql`
      UPDATE merchants
      SET vacation_mode = ${enabled},
          vacation_message = ${finalMsg},
          updated_at = now()
      WHERE id = ${merchantId}::uuid
    `;

    if (enabled) {
      await redis.set(`vacation_mode:${merchantId}`, finalMsg, 'EX', 86400 * 14);
    } else {
      await redis.del(`vacation_mode:${merchantId}`);
    }

    logger.info(`[MerchantSettingsService] Vacation mode set to ${enabled} for merchant ${merchantId}`);

    return {
      success: true,
      vacationMode: enabled,
      message: enabled
        ? `Vacation mode enabled. Customers will receive: "${finalMsg}"`
        : 'Vacation mode disabled. Normal AI sales operations resumed.',
    };
  }

  /**
   * Configure platform fee padding model.
   */
  static async configureFeePadding(
    merchantId: string,
    model: 'customer_padded' | 'merchant_absorbed' | 'split'
  ): Promise<{ success: boolean; model: string }> {
    await sql`
      UPDATE merchants
      SET fee_padding_model = ${model}, updated_at = now()
      WHERE id = ${merchantId}::uuid
    `;
    return { success: true, model };
  }
}
