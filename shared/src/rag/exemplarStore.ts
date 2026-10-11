import { sql } from '../clients.js';
import { logger } from '../logger.js';
import type { Dialect } from '../types.js';

export interface Exemplar {
  id?: string;
  dialect: Dialect | string;
  scenarioType: 'price_negotiation' | 'order_fulfillment' | 're_engagement' | 'restocking' | 'general';
  customerTier: 'new' | 'returning' | 'loyal' | 'vip';
  customerMessage: string;
  aiResponse: string;
  merchantWording?: string;
  outcome: string;
  qualityScore?: number;
}

/**
 * High-quality seed exemplars for Nigerian commerce.
 * Grounded in authentic dialect nuances, relationship anchoring, and pricing guardrails.
 */
const SEED_EXEMPLARS: Exemplar[] = [
  // --- PIDGIN ---
  {
    dialect: 'pidgin',
    scenarioType: 'price_negotiation',
    customerTier: 'returning',
    customerMessage: 'How much last for that gele? 15k dey my hand make I pay now.',
    aiResponse: 'My sister, welcome back! That one na premium quality Swiss organza, ₦15k go make us lose money. Last price wey oga fit approve for you as our good customer na ₦18,500, and I fit add free delivery within Ikeja.',
    outcome: 'converted',
    qualityScore: 1.0,
  },
  {
    dialect: 'pidgin',
    scenarioType: 'price_negotiation',
    customerTier: 'new',
    customerMessage: 'Abeg reduce am for me, ₦30k too cost.',
    aiResponse: 'Good day! Thank you for checking our store. That gown na original Grade-A Turkish crepe, full quality guaranteed. List price na ₦30,000, but I fit give you our first-time welcome price at ₦28,000. How you see am?',
    outcome: 'converted',
    qualityScore: 0.95,
  },
  {
    dialect: 'pidgin',
    scenarioType: 'order_fulfillment',
    customerTier: 'loyal',
    customerMessage: 'I don pay oh, when rider go reach?',
    aiResponse: 'Confirm! Payment received with thanks. Your package don pack finish, rider dey on way to pick am now. Dispatch estimate na within 45 minutes.',
    outcome: 'converted',
    qualityScore: 1.0,
  },
  {
    dialect: 'pidgin',
    scenarioType: 're_engagement',
    customerTier: 'vip',
    customerMessage: 'Long time. You get that silk shirt again?',
    aiResponse: 'Chief! Good to hear from you. The silk shirts just land yesterday from Italy, limited pieces. Because na you, I reserve your size first before we post for status. Should I send the colors?',
    outcome: 'converted',
    qualityScore: 1.0,
  },

  // --- YORUBA-INFLECTED ---
  {
    dialect: 'yoruba',
    scenarioType: 'price_negotiation',
    customerTier: 'loyal',
    customerMessage: 'Ẹ kú iṣẹ́ ma. Can you do ₦22k for two pieces?',
    aiResponse: 'Ẹ kú iṣẹ́ ma. Daalụ for reaching out again! The fabric quality is top-notch. For two pieces, I can do ₦24,500 each as our family discount and ensure same-day dispatch. Ó dára ma?',
    outcome: 'converted',
    qualityScore: 0.95,
  },
  {
    dialect: 'yoruba',
    scenarioType: 're_engagement',
    customerTier: 'returning',
    customerMessage: 'Do you still have the lace material in royal blue?',
    aiResponse: 'Ẹ kú ìrọ̀lẹ́ ma! Yes, we have exactly 3 bundles left in royal blue. High-grade lustre lace. Shall I hold one bundle for you before it sells out?',
    outcome: 'converted',
    qualityScore: 0.95,
  },

  // --- IGBO-INFLECTED ---
  {
    dialect: 'igbo',
    scenarioType: 'price_negotiation',
    customerTier: 'returning',
    customerMessage: 'Nna, ₦40k too high. What is your bottom price?',
    aiResponse: 'Daalụ sir. We source these directly from factory so margin is very slim. Because you are our regular brother, I can offer ₦36,500 with warranty. Ọ dị mma sir?',
    outcome: 'converted',
    qualityScore: 0.95,
  },
  {
    dialect: 'igbo',
    scenarioType: 'order_fulfillment',
    customerTier: 'vip',
    customerMessage: 'Where is my tracking number for the Aba shipment?',
    aiResponse: 'Good afternoon Chief. Your consignment has been loaded on the luxury transit coach, tracking receipt number is GIG-7729. Arrival is scheduled for tomorrow morning.',
    outcome: 'converted',
    qualityScore: 1.0,
  },

  // --- HAUSA-INFLECTED ---
  {
    dialect: 'hausa',
    scenarioType: 'price_negotiation',
    customerTier: 'new',
    customerMessage: 'Sannu. I want 5 bags. Can you give discount?',
    aiResponse: 'Sannu da zuwa sir! For 5 bags wholesale quantity, we gladly offer ₦14,000 per bag instead of ₦16,000 list price. Total is ₦70,000 with direct waybill to Kano. Madalla!',
    outcome: 'converted',
    qualityScore: 0.95,
  },

  // --- ENGLISH ---
  {
    dialect: 'english',
    scenarioType: 'price_negotiation',
    customerTier: 'new',
    customerMessage: 'Hello, can you give me a discount on the black leather tote bag?',
    aiResponse: 'Hello! Thank you for your interest. That bag is crafted from full-grain leather with brass hardware. While list price is ₦35,000, I can extend a courtesy introductory offer of ₦32,500 with complimentary dust bag and city delivery. Would you like me to reserve it for you?',
    outcome: 'converted',
    qualityScore: 1.0,
  },
  {
    dialect: 'english',
    scenarioType: 'price_negotiation',
    customerTier: 'vip',
    customerMessage: 'I am ordering for my company event. Need 20 units.',
    aiResponse: 'Good day! We appreciate your corporate partnership. For 20 units, we are authorized to apply our tier-one volume price of ₦18,000 per unit (down from ₦22,000) with dedicated courier dispatch. Would you like the official pro-forma invoice?',
    outcome: 'converted',
    qualityScore: 1.0,
  },
];

export class ExemplarStore {
  private static instance: ExemplarStore;

  public static getInstance(): ExemplarStore {
    if (!ExemplarStore.instance) {
      ExemplarStore.instance = new ExemplarStore();
    }
    return ExemplarStore.instance;
  }

  /**
   * Seed the Postgres database with baseline exemplars if empty.
   */
  public async ensureSeedData(): Promise<void> {
    try {
      const existing = await sql<{ count: string }[]>`
        SELECT count(*) as count FROM interaction_exemplars
      `;
      if (parseInt(existing[0]?.count || '0', 10) === 0) {
        logger.info('[ExemplarStore] Seeding database with initial interaction exemplars...');
        for (const ex of SEED_EXEMPLARS) {
          await sql`
            INSERT INTO interaction_exemplars (
              dialect, scenario_type, customer_tier,
              customer_message, ai_response, outcome, quality_score
            ) VALUES (
              ${ex.dialect}, ${ex.scenarioType}, ${ex.customerTier},
              ${ex.customerMessage}, ${ex.aiResponse}, ${ex.outcome}, ${ex.qualityScore || 1.0}
            )
          `;
        }
      }
    } catch (err) {
      logger.warn('[ExemplarStore] Non-fatal seed check warning:', err);
    }
  }

  /**
   * Retrieve top successful exemplars matching the given criteria.
   * Pulls from Postgres database with seed fallback.
   */
  public async getSuccessfulExemplars(criteria: {
    dialect?: string;
    scenarioType?: string;
    customerTier?: string;
    limit?: number;
  }): Promise<Exemplar[]> {
    const dialect = criteria.dialect || 'pidgin';
    const scenario = criteria.scenarioType || 'price_negotiation';
    const tier = criteria.customerTier || 'new';
    const limit = criteria.limit || 3;

    try {
      // 1. Query verified database exemplars first
      const rows = await sql<Exemplar[]>`
        SELECT
          dialect,
          scenario_type as "scenarioType",
          customer_tier as "customerTier",
          customer_message as "customerMessage",
          ai_response as "aiResponse",
          merchant_wording as "merchantWording",
          outcome,
          quality_score as "qualityScore"
        FROM interaction_exemplars
        WHERE (dialect = ${dialect} OR dialect = 'english')
        ORDER BY
          (dialect = ${dialect})::int DESC,
          (scenario_type = ${scenario})::int DESC,
          (customer_tier = ${tier})::int DESC,
          quality_score DESC
        LIMIT ${limit}
      `;

      if (rows.length > 0) {
        return rows;
      }
    } catch (err) {
      logger.warn('[ExemplarStore] Database query fallback to in-memory seeds:', err);
    }

    // 2. In-memory seed matching fallback
    const matched = SEED_EXEMPLARS.filter(
      (e) => e.dialect === dialect && e.scenarioType === scenario
    );

    if (matched.length >= limit) return matched.slice(0, limit);

    // Fallback: match by dialect only, then generic
    const dialectMatch = SEED_EXEMPLARS.filter((e) => e.dialect === dialect);
    if (dialectMatch.length > 0) return dialectMatch.slice(0, limit);

    return SEED_EXEMPLARS.slice(0, limit);
  }

  /**
   * Save a newly verified interaction into the exemplar memory.
   */
  public async recordExemplar(exemplar: Exemplar): Promise<void> {
    try {
      await sql`
        INSERT INTO interaction_exemplars (
          dialect, scenario_type, customer_tier,
          customer_message, ai_response, merchant_wording,
          outcome, quality_score
        ) VALUES (
          ${exemplar.dialect},
          ${exemplar.scenarioType},
          ${exemplar.customerTier},
          ${exemplar.customerMessage},
          ${exemplar.aiResponse},
          ${exemplar.merchantWording || null},
          ${exemplar.outcome},
          ${exemplar.qualityScore || 1.0}
        )
      `;
      logger.info(`[ExemplarStore] 📚 Exemplar recorded for [${exemplar.dialect} | ${exemplar.scenarioType}]`);
    } catch (err) {
      logger.error('[ExemplarStore] Failed to persist exemplar:', err);
    }
  }

  /**
   * Format exemplars into a prompt section for system injection.
   */
  public formatExemplarsForPrompt(exemplars: Exemplar[]): string {
    if (!exemplars || exemplars.length === 0) return '';

    const lines = [
      '══ VERIFIED HISTORICAL EXEMPLARS (LEARNED CONVERSATIONAL PATTERNS) ══',
      'The following are real, high-converting exchanges matching this customer tier and dialect.',
      'Emulate this tone, concise tempo, and cultural nuance naturally:',
      '',
    ];

    exemplars.forEach((ex, i) => {
      lines.push(`[Exemplar #${i + 1} | Dialect: ${ex.dialect.toUpperCase()} | Tier: ${ex.customerTier}]`);
      lines.push(`Customer: "${ex.customerMessage}"`);
      lines.push(`You: "${ex.merchantWording || ex.aiResponse}"`);
      lines.push(`Outcome: Closed / Converted`);
      lines.push('');
    });

    return lines.join('\n');
  }
}

export const exemplarStore = ExemplarStore.getInstance();
