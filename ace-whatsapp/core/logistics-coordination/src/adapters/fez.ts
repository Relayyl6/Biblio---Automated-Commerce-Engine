import { LogisticsProvider, OrderPayload, DispatchResult, TrackingUpdate } from '../types.js';
import { getMerchantApiKey } from '@ace/shared/integrations/credentials.js';
import crypto from 'node:crypto';

export class FezAdapter implements LogisticsProvider {
  private explicitApiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.explicitApiKey = apiKey;
    this.baseUrl = baseUrl || process.env.FEZ_API_URL || 'https://api.fezdelivery.co/v1';
  }

  private async resolveKey(merchantId?: string): Promise<string | null> {
    if (this.explicitApiKey && !this.explicitApiKey.includes('your_')) {
      return this.explicitApiKey;
    }
    const key = await getMerchantApiKey(merchantId, 'fez');
    return key || process.env.FEZ_API_KEY || null;
  }

  async quote(order: OrderPayload): Promise<number> {
    const weight = order.totalWeightKg || 1;
    // Standard Fez regional intra-state vs inter-state benchmark rate
    const isIntraState = order.pickupAddress?.state?.toLowerCase() === order.dropoffAddress?.state?.toLowerCase();
    const baseRate = isIntraState ? 1800.00 : 3800.00;
    const weightExtra = weight > 2 ? (weight - 2) * 300.00 : 0;
    return baseRate + weightExtra;
  }

  async dispatch(order: OrderPayload): Promise<DispatchResult> {
    const apiKey = await this.resolveKey(order.merchantId);
    if (!apiKey) {
      return { success: false, provider: 'fez', error: 'Missing FEZ_API_KEY for merchant or platform' };
    }

    try {
      const payload = {
        order_reference: order.orderId,
        merchant_id: order.merchantId,
        recipient_name: order.dropoffAddress?.contactName || 'Customer',
        recipient_phone: order.customerPhone || order.dropoffAddress?.contactPhone,
        pickup_address: `${order.pickupAddress.street}, ${order.pickupAddress.city}, ${order.pickupAddress.state}`,
        dropoff_address: `${order.dropoffAddress.street}, ${order.dropoffAddress.city}, ${order.dropoffAddress.state}`,
        declared_value: order.declaredValue || 5000,
        weight_kg: order.totalWeightKg || 1,
        delivery_type: 'express'
      };

      const res = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Fez API Error (${res.status}): ${errText}`);
      }

      const data = (await res.json()) as any;
      const trackingNumber = data?.data?.order_id || data?.order_id || order.orderId;
      const trackingUrl = data?.data?.tracking_url || `https://track.fezdelivery.co/${trackingNumber}`;

      return {
        success: true,
        provider: 'fez',
        trackingNumber: String(trackingNumber),
        trackingUrl,
        estimatedDelivery: data?.data?.estimated_delivery_time || new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
        cost: parseFloat(data?.data?.amount) || 1800.00
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'fez',
        error: err.message || 'Unknown error occurred during Fez dispatch'
      };
    }
  }

  verifyWebhook(signature: string, payload: any): boolean {
    const secret = process.env.FEZ_WEBHOOK_SECRET || process.env.LOGISTICS_WEBHOOK_SECRET;
    if (!secret) return true; // If no secret configured, allow in dev/sandbox
    if (!signature) return false;

    try {
      const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(signature.replace(/^sha256=/i, ''));
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhook(payload: any): TrackingUpdate | null {
    if (!payload || (!payload.order_id && !payload.tracking_id)) return null;

    const trackingNumber = String(payload.order_id || payload.tracking_id);
    let status: TrackingUpdate['status'] = 'pending';

    const s = String(payload.status || payload.state || '').toUpperCase();
    if (s.includes('TRANSIT') || s.includes('EN_ROUTE') || s.includes('DISPATCHED')) {
      status = 'in_transit';
    } else if (s.includes('DELIVERED') || s.includes('COMPLETED')) {
      status = 'delivered';
    } else if (s.includes('FAILED') || s.includes('CANCELLED') || s.includes('RETURNED')) {
      status = 'failed';
    }

    return {
      provider: 'fez',
      trackingNumber,
      status,
      timestamp: payload.updated_at || new Date().toISOString(),
      driverName: payload.rider?.name || payload.driver_name,
      driverPhone: payload.rider?.phone || payload.driver_phone,
      rawPayload: payload
    };
  }
}
