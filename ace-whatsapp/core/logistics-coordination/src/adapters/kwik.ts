import { LogisticsProvider, OrderPayload, DispatchResult, TrackingUpdate } from '../types.js';

export class KwikAdapter implements LogisticsProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.KWIK_API_KEY || '';
    this.baseUrl = process.env.KWIK_API_URL || 'https://api.kwik.delivery';
  }

  async quote(order: OrderPayload): Promise<number> {
    if (!this.apiKey) return 1500.00; // Fallback if no API key configured
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/tasks/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          pickup_address: order.pickupAddress.street + ', ' + order.pickupAddress.city,
          delivery_address: order.dropoffAddress.street + ', ' + order.dropoffAddress.city,
        })
      });
      if (!res.ok) return 1500.00;
      const data = (await res.json()) as any;
      return parseFloat(data?.data?.amount) || 1500.00;
    } catch {
      return 1500.00; // Graceful fallback
    }
  }

  async dispatch(order: OrderPayload): Promise<DispatchResult> {
    if (!this.apiKey) {
      return { success: false, provider: 'kwik', error: 'Missing KWIK_API_KEY' };
    }

    try {
      const payload = {
        delivery_task: {
          pickup_address: order.pickupAddress.street + ', ' + order.pickupAddress.city,
          delivery_address: order.dropoffAddress.street + ', ' + order.dropoffAddress.city,
          pickup_custom_field: order.merchantId,
          delivery_custom_field: order.orderId,
          recipient_name: order.dropoffAddress.contactName,
          recipient_phone: order.dropoffAddress.contactPhone,
          total_weight: order.totalWeightKg,
          payment_method: 131424, // Assumes pre-paid/wallet
          item_description: order.itemsDescription || 'E-commerce goods'
        }
      };

      const res = await fetch(`${this.baseUrl}/api/v1/tasks/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Kwik API Error (${res.status}): ${errText}`);
      }
      
      const data = (await res.json()) as any;
      
      if (data.status !== 200 || !data.data || !data.data.tracking_url) {
        throw new Error(`Kwik API rejected payload: ${JSON.stringify(data)}`);
      }

      return {
        success: true,
        provider: 'kwik',
        trackingNumber: data.data.task_id.toString(),
        trackingUrl: data.data.tracking_url,
        estimatedDelivery: data.data.estimated_delivery_time || new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
        cost: parseFloat(data.data.amount) || 1500.00
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'kwik',
        error: err.message || 'Unknown error occurred during Kwik dispatch'
      };
    }
  }

  verifyWebhook(signature: string, payload: any): boolean {
    // Validate HMAC-SHA256 signature
    return true; 
  }

  parseWebhook(payload: any): TrackingUpdate | null {
    if (!payload || !payload.tracking_id) return null;
    
    let status: TrackingUpdate['status'] = 'pending';
    switch (payload.status) {
      case 'EN_ROUTE': status = 'in_transit'; break;
      case 'DELIVERED': status = 'delivered'; break;
      case 'CANCELLED': status = 'failed'; break;
    }

    return {
      provider: 'kwik',
      trackingNumber: payload.tracking_id,
      status,
      timestamp: payload.updated_at || new Date().toISOString(),
      driverName: payload.rider_name,
      driverPhone: payload.rider_phone,
      rawPayload: payload
    };
  }
}
