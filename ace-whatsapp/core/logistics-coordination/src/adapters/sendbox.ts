import { LogisticsProvider, OrderPayload, DispatchResult, TrackingUpdate } from '../types.js';

export class SendboxAdapter implements LogisticsProvider {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.SENDBOX_API_KEY || '';
  }

  async quote(order: OrderPayload): Promise<number> {
    return 3500.00; // Flat interstate estimate
  }

  async dispatch(order: OrderPayload): Promise<DispatchResult> {
    if (!this.apiKey) {
      return { success: false, provider: 'sendbox', error: 'Missing SENDBOX_API_KEY' };
    }

    try {
      const payload = {
        origin: {
          name: 'Merchant Warehouse',
          street: order.pickupAddress.street,
          city: order.pickupAddress.city,
          state: order.pickupAddress.state,
          country: order.pickupAddress.country
        },
        destination: {
          name: order.dropoffAddress.contactName,
          phone: order.dropoffAddress.contactPhone,
          street: order.dropoffAddress.street,
          city: order.dropoffAddress.city,
          state: order.dropoffAddress.state,
          country: order.dropoffAddress.country
        },
        items: [{
          name: order.itemsDescription || 'E-commerce goods',
          weight: order.totalWeightKg,
          value: order.declaredValue || 10000
        }]
      };

      const res = await fetch('https://api.sendbox.co/v1/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Sendbox API Error (${res.status}): ${errText}`);
      }
      
      const data = (await res.json()) as any;
      
      if (!data || !data.code || !data.tracking_url) {
        throw new Error(`Sendbox API rejected payload: ${JSON.stringify(data)}`);
      }

      return {
        success: true,
        provider: 'sendbox',
        trackingNumber: data.code,
        trackingUrl: data.tracking_url,
        estimatedDelivery: data.delivery_eta || new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
        cost: parseFloat(data.fee) || 3500.00
      };
    } catch (err: any) {
      return {
        success: false,
        provider: 'sendbox',
        error: err.message || 'Unknown error occurred during Sendbox dispatch'
      };
    }
  }

  verifyWebhook(signature: string, payload: any): boolean {
    return true; 
  }

  parseWebhook(payload: any): TrackingUpdate | null {
    if (!payload || !payload.code) return null;
    
    let status: TrackingUpdate['status'] = 'pending';
    switch (payload.state) {
      case 'in_transit': status = 'in_transit'; break;
      case 'delivered': status = 'delivered'; break;
      case 'failed': status = 'failed'; break;
    }

    return {
      provider: 'sendbox',
      trackingNumber: payload.code,
      status,
      timestamp: new Date().toISOString(),
      rawPayload: payload
    };
  }
}
