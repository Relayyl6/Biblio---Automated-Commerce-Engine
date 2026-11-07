import { logger } from "@ace/shared/logger.js";
// shared/src/data-intelligence/engine.ts
//
// Role: Centralized Data-Intelligence Fixture for telemetry and analytical processing.
// This is the core Layer 3 data ingestion point for the "Scale AI of informal commerce" arc.
// All ACE apps and services pipe their analytical events here. 

import { OrderState, ConversationTurn } from '../types.js';
import { sql } from '../clients.js';

// --- Types ---

export type Dialect = 'pidgin' | 'yoruba' | 'igbo' | 'hausa' | 'english';
export type CustomerTier = 'new' | 'returning' | 'loyal' | 'vip';
export type NegotiationTactic = 'relationship_anchor' | 'bundle_pivot' | 'scarcity_signal' | 'future_credit' | 'urgency_window' | 'social_close';

/**
 * Enterprise Data Asset: The Negotiation Trace.
 * Sold to FMCGs for price elasticity signals.
 */
export interface NegotiationTrace {
  sessionId: string;
  merchantId: string;
  customerId: string;
  customerTier: CustomerTier;
  anchorPrice: number;
  authorizedFloor: number;
  outcome: 'closed' | 'below_floor_escalated' | 'bundle_closed' | 'abandoned';
  finalPrice?: number;
  finalMargin?: number;
  tacticsDeployed: NegotiationTactic[];
  tacticsSucceeded: NegotiationTactic[];
  priceElasticitySignal: number;
  dialect: Dialect;
}

/**
 * Enterprise Data Asset: Order Metrics / TrustScore Signals.
 * Sold to banks for credit scoring.
 */
export interface OrderMetricsPayload {
  merchantId: string;
  customerId: string;
  orderId: string;
  fromState: OrderState['status'];
  toState: OrderState['status'];
  timestamp: number;
}

/**
 * Enterprise Data Asset: Audit Log / Anomaly Detection.
 */
export interface AuditLogPayload {
  service: string;
  merchantId: string;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface RFMScore {
  recencyDays: number;
  frequency: number;
  monetaryTotal: number;
  averageOrderValue: number;
  segment: 'champions' | 'loyal' | 'at_risk' | 'hibernating' | 'new';
}

// --- The Data Intelligence Engine ---

export class DataIntelligenceEngine {
  private static instance: DataIntelligenceEngine;

  private constructor() {}

  public static getInstance(): DataIntelligenceEngine {
    if (!DataIntelligenceEngine.instance) {
      DataIntelligenceEngine.instance = new DataIntelligenceEngine();
    }
    return DataIntelligenceEngine.instance;
  }

  /**
   * Process and persist a negotiation trace.
   * Feeds the FMCG Market Intelligence product.
   */
  public async logNegotiationTrace(trace: NegotiationTrace): Promise<void> {
    logger.log(`[DataIntel] 📈 NegotiationTrace Logged: Session ${trace.sessionId} | Outcome: ${trace.outcome} | Elasticity: ${trace.priceElasticitySignal.toFixed(2)}`);
    
    // Pattern Detection: Identify aggressive downward elasticity
    if (trace.priceElasticitySignal < 0.7) {
      this.flagAnomaly(trace.merchantId, 'severe_price_pushback', trace);
    }
  }

  /**
   * Capture state transitions to detect fulfillment reliability.
   * Feeds the TrustScore API product for banks.
   */
  public async captureOrderStateChange(metrics: OrderMetricsPayload): Promise<void> {
    logger.log(`[DataIntel] 🔄 OrderStateChange: Order ${metrics.orderId} [${metrics.fromState} -> ${metrics.toState}]`);
  }

  /**
   * High-priority centralized audit logger for system events.
   * Persists to PostgreSQL audit_logs table for enterprise compliance.
   */
  public async auditLog(payload: Omit<AuditLogPayload, 'timestamp'>): Promise<void> {
    const log: AuditLogPayload = {
      ...payload,
      timestamp: Date.now()
    };
    
    logger.log(`[DataIntel] 🔒 Audit [${log.service}]: ${log.merchantId} - ${log.action}`);
    
    try {
      await sql`
        INSERT INTO audit_logs (service, merchant_id, action, metadata, created_at)
        VALUES (
          ${log.service},
          ${log.merchantId},
          ${log.action},
          ${sql.json((log.metadata || {}) as any)},
          NOW()
        )
      `;
    } catch (dbErr) {
      logger.warn('[DataIntel] Failed to persist audit log to DB:', dbErr);
    }
  }

  /**
   * Retrieve audit logs per merchant for compliance and dashboard viewing.
   */
  public async getAuditLogs(merchantId: string, limit: number = 50): Promise<any[]> {
    try {
      const rows = await sql<any[]>`
        SELECT id, service, merchant_id, action, metadata, created_at
        FROM audit_logs
        WHERE merchant_id = ${merchantId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return rows;
    } catch {
      return [];
    }
  }

  /**
   * Log AI token consumption per merchant for cost attribution and billing.
   */
  public async logTokenUsage(payload: {
    service: string;
    merchantId: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    const total = payload.promptTokens + payload.completionTokens;
    logger.info(
      `[DataIntel] 🤖 TokenUsage [${payload.service}]: merchant=${payload.merchantId} ` +
      `model=${payload.model} prompt=${payload.promptTokens} completion=${payload.completionTokens} total=${total}`
    );
    await this.auditLog({
      service: payload.service,
      merchantId: payload.merchantId,
      action: "llm_token_usage",
      metadata: {
        model: payload.model,
        promptTokens: payload.promptTokens,
        completionTokens: payload.completionTokens,
        total,
      },
    });
  }

  /**
   * Capture inventory intake events across vendor channels (WhatsApp, webhooks, voice).
   * Feeds the FMCG product intel stream.
   */
  public async logInventoryIngestion(payload: {
    merchantId: string;
    vendorId: string;
    sku: string;
    productName: string;
    price: number | null;
    stock: number;
    source: "whatsapp_voice" | "whatsapp_image" | "manual" | "catalog_sync";
  }): Promise<void> {
    logger.info(
      `[DataIntel] 📦 InventoryIngestion: merchant=${payload.merchantId} vendor=${payload.vendorId} ` +
      `sku=${payload.sku} price=₦${payload.price ?? 0} stock=${payload.stock} source=${payload.source}`
    );
    await this.auditLog({
      service: "baileys-gateway",
      merchantId: payload.merchantId,
      action: "inventory_ingested",
      metadata: payload as Record<string, unknown>,
    });
  }

  /**
   * Computes RFM (Recency, Frequency, Monetary) analytics for customer segmentation.
   * Handles 0-order customers gracefully without NaN or errors.
   */
  public calculateRFM(orders: { createdAt: number | string | Date; amount: number }[]): RFMScore {
    if (!orders || orders.length === 0) {
      return {
        recencyDays: 999,
        frequency: 0,
        monetaryTotal: 0,
        averageOrderValue: 0,
        segment: 'new'
      };
    }

    const now = Date.now();
    const timestamps = orders.map(o => new Date(o.createdAt).getTime());
    const latestTimestamp = Math.max(...timestamps);
    const recencyDays = Math.max(0, Math.floor((now - latestTimestamp) / (24 * 60 * 60 * 1000)));

    const frequency = orders.length;
    const monetaryTotal = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const averageOrderValue = frequency > 0 ? Math.round(monetaryTotal / frequency) : 0;

    let segment: 'champions' | 'loyal' | 'at_risk' | 'hibernating' | 'new' = 'new';
    if (frequency >= 5 && recencyDays <= 30) {
      segment = 'champions';
    } else if (frequency >= 2 && recencyDays <= 30) {
      segment = 'loyal';
    } else if (frequency >= 1 && recencyDays > 30 && recencyDays <= 90) {
      segment = 'at_risk';
    } else if (recencyDays > 90) {
      segment = 'hibernating';
    }

    return {
      recencyDays,
      frequency,
      monetaryTotal,
      averageOrderValue,
      segment
    };
  }

  /**
   * Computes Customer Lifetime Value (CLV).
   * Guaranteed safe against division by zero.
   */
  public calculateCLV(orders: { amount: number }[], churnRate: number = 0.2): number {
    if (!orders || orders.length === 0 || churnRate <= 0) {
      return 0;
    }
    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const aov = totalRevenue / orders.length;
    const purchaseFrequency = orders.length;
    const customerValue = aov * purchaseFrequency;
    return Math.round(customerValue / churnRate);
  }

  /**
   * Internal mechanism to flag behavioral anomalies across the network.
   */
  private async flagAnomaly(merchantId: string, anomalyType: string, context: unknown) {
    logger.warn(`[DataIntel] ⚠️ Anomaly Detected [${anomalyType}] for merchant: ${merchantId}`);
    try {
      const { eventBus } = await import('../eventBus.js');
      await eventBus.publish('anomaly_detected', { merchantId, anomalyType, context });
      await this.auditLog({
        service: 'data-intelligence',
        merchantId,
        action: `anomaly:${anomalyType}`,
        metadata: { context } as Record<string, unknown>
      });
    } catch (e) {
      logger.error('[DataIntel] Failed to emit anomaly event', e);
    }
  }
}

// Export singleton instance for immediate use
export const dataIntelligence = DataIntelligenceEngine.getInstance();
