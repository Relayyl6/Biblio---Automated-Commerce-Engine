import { sql, jsonb } from '../clients.js';
import { logger } from '../logger.js';
import { exemplarStore } from '../rag/exemplarStore.js';
import { pricingBandit, BanditArm, BANDIT_ARMS } from '../rl/pricingBandit.js';
import type { CustomerTier, Dialect } from '../types.js';

export type MerchantAction = 'sent_as_is' | 'edited' | 'rejected' | 'auto_sent';
export type CustomerResponse = 'replied_positive' | 'converted' | 'silent' | 'complained';
export type OrderOutcome = 'completed_full_margin' | 'completed_discount' | 'abandoned' | 'refunded';

export interface InteractionRecordParams {
  merchantId: string;
  customerId: string;
  sessionId?: string;
  contextSnapshot: {
    customerProfile?: any;
    lastMessages?: any[];
    productSku?: string;
    stage?: string;
    [key: string]: any;
  };
  aiDraft: string;
  merchantAction?: MerchantAction;
  merchantCorrectedText?: string;
  customerResponse?: CustomerResponse;
  orderOutcome?: OrderOutcome;
  discountOffered?: number;
  marginRealized?: number;
  dialect?: Dialect | string;
  region?: string;
  customerTier?: CustomerTier | string;
  scenarioType?: string;
  banditArm?: BanditArm | string;
}

export class InteractionFeedbackService {
  private static instance: InteractionFeedbackService;

  public static getInstance(): InteractionFeedbackService {
    if (!InteractionFeedbackService.instance) {
      InteractionFeedbackService.instance = new InteractionFeedbackService();
    }
    return InteractionFeedbackService.instance;
  }

  /**
   * Log every interaction to the conversation_outcomes data foundation.
   */
  public async recordInteraction(params: InteractionRecordParams): Promise<string | null> {
    try {
      const rows = await sql<{ id: string }[]>`
        INSERT INTO conversation_outcomes (
          merchant_id, customer_id, session_id,
          context_snapshot, ai_draft, merchant_action,
          merchant_corrected_text, customer_response, order_outcome,
          discount_offered, margin_realized, dialect,
          region, customer_tier, scenario_type,
          bandit_arm, reward, created_at, updated_at
        ) VALUES (
          ${params.merchantId},
          ${params.customerId},
          ${params.sessionId || null},
          ${jsonb(params.contextSnapshot)},
          ${params.aiDraft},
          ${params.merchantAction || 'sent_as_is'},
          ${params.merchantCorrectedText || null},
          ${params.customerResponse || null},
          ${params.orderOutcome || null},
          ${params.discountOffered || 0},
          ${params.marginRealized || 0},
          ${params.dialect || 'pidgin'},
          ${params.region || null},
          ${params.customerTier || 'new'},
          ${params.scenarioType || 'price_negotiation'},
          ${params.banditArm ? String(params.banditArm) : null},
          null,
          now(),
          now()
        )
        RETURNING id
      `;

      const id = rows[0]?.id;
      logger.info(`[Feedback] 📝 Recorded interaction outcome ${id} for customer ${params.customerId}`);
      return id || null;
    } catch (err) {
      logger.error('[Feedback] Failed to record interaction outcome:', err);
      return null;
    }
  }

  /**
   * Record when merchant approves, edits, or rejects an AI draft.
   * If edited/rejected, creates a preference pair for DPO / future tuning.
   */
  public async recordMerchantAction(
    interactionId: string,
    action: MerchantAction,
    correctedText?: string
  ): Promise<void> {
    try {
      await sql`
        UPDATE conversation_outcomes
        SET
          merchant_action = ${action},
          merchant_corrected_text = ${correctedText || null},
          updated_at = now()
        WHERE id = ${interactionId}
      `;
      logger.info(`[Feedback] ✏️ Recorded merchant action [${action}] on interaction ${interactionId}`);
    } catch (err) {
      logger.error(`[Feedback] Failed to record merchant action for ${interactionId}:`, err);
    }
  }

  /**
   * Record customer response.
   * If customer responded positively or converted, qualifies for RAG exemplar memory.
   */
  public async recordCustomerResponse(
    interactionId: string,
    response: CustomerResponse
  ): Promise<void> {
    try {
      const rows = await sql<{
        dialect: string;
        scenario_type: string;
        customer_tier: string;
        ai_draft: string;
        merchant_corrected_text: string | null;
        context_snapshot: any;
      }[]>`
        UPDATE conversation_outcomes
        SET
          customer_response = ${response},
          updated_at = now()
        WHERE id = ${interactionId}
        RETURNING dialect, scenario_type, customer_tier, ai_draft, merchant_corrected_text, context_snapshot
      `;

      const row = rows[0];
      if (row && (response === 'replied_positive' || response === 'converted')) {
        // Extract customer's last message from snapshot
        const lastMsg =
          row.context_snapshot?.lastMessages?.slice(-1)[0]?.text ||
          row.context_snapshot?.customerMessage ||
          'Inquiry';

        await exemplarStore.recordExemplar({
          dialect: row.dialect,
          scenarioType: row.scenario_type as any,
          customerTier: row.customer_tier as any,
          customerMessage: lastMsg,
          aiResponse: row.ai_draft,
          merchantWording: row.merchant_corrected_text || undefined,
          outcome: response,
          qualityScore: response === 'converted' ? 1.0 : 0.85,
        });
      }
    } catch (err) {
      logger.error(`[Feedback] Failed to record customer response for ${interactionId}:`, err);
    }
  }

  /**
   * Backdate order outcome onto the original interaction row once it resolves.
   * Calculates margin reward and feeds into the LinUCB bandit update loop.
   */
  public async recordOrderOutcome(params: {
    sessionId?: string;
    customerId?: string;
    merchantId?: string;
    outcome: OrderOutcome;
    marginRealized: number;
    finalPrice: number;
  }): Promise<void> {
    try {
      // Find the most recent matching interaction row
      const rows = await sql<{
        id: string;
        bandit_arm: string | null;
        merchant_action: string;
        context_snapshot: any;
      }[]>`
        SELECT id, bandit_arm, merchant_action, context_snapshot
        FROM conversation_outcomes
        WHERE (session_id = ${params.sessionId || ''} OR customer_id = ${params.customerId || ''})
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const interaction = rows[0];
      if (!interaction) {
        logger.warn(`[Feedback] No interaction found to backdate order outcome`);
        return;
      }

      // Compute reward:
      // r = 1{completed} * margin_realized - lambda * 1{merchant_override}
      const isCompleted = params.outcome === 'completed_full_margin' || params.outcome === 'completed_discount';
      const wasOverridden = interaction.merchant_action === 'edited' || interaction.merchant_action === 'rejected';
      const lambdaPenalty = 0.25;

      const baseReward = isCompleted ? Math.max(0.05, params.marginRealized / 100_000) : -0.2;
      const penalty = wasOverridden ? lambdaPenalty : 0;
      const reward = parseFloat((baseReward - penalty).toFixed(4));

      await sql`
        UPDATE conversation_outcomes
        SET
          order_outcome = ${params.outcome},
          margin_realized = ${params.marginRealized},
          reward = ${reward},
          updated_at = now()
        WHERE id = ${interaction.id}
      `;

      // Update bandit arm if a bandit arm was selected during negotiation
      if (interaction.bandit_arm !== null) {
        const armVal = parseFloat(interaction.bandit_arm) as BanditArm;
        if (BANDIT_ARMS.includes(armVal)) {
          const snapshot = interaction.context_snapshot || {};
          const contextVector = pricingBandit.buildContextVector({
            customerLtv: snapshot.customerProfile?.lifetimeValue,
            orderCount: snapshot.customerProfile?.orderCount,
            productMargin: snapshot.productMargin,
            basePrice: params.finalPrice,
          });

          await pricingBandit.recordFeedback(armVal, contextVector, reward);
        }
      }

      logger.info(`[Feedback] 🏆 Backdated order outcome [${params.outcome}] with reward ${reward} to interaction ${interaction.id}`);
    } catch (err) {
      logger.error('[Feedback] Failed to backdate order outcome:', err);
    }
  }
}

export const interactionFeedback = InteractionFeedbackService.getInstance();
