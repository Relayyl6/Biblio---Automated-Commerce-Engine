export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  contactName: string;
  contactPhone: string;
}

export interface OrderPayload {
  orderId: string;
  customerPhone?: string;
  merchantId: string;
  customerId: string;
  totalWeightKg: number;
  pickupAddress: DeliveryAddress;
  dropoffAddress: DeliveryAddress;
  itemsDescription: string;
  declaredValue: number;
}

export interface DispatchResult {
  success: boolean;
  provider: 'kwik' | 'sendbox';
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  error?: string;
  cost?: number;
}

export interface TrackingUpdate {
  provider: 'kwik' | 'sendbox';
  trackingNumber: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'returned';
  timestamp: string;
  driverName?: string;
  driverPhone?: string;
  rawPayload: any;
}

export interface LogisticsProvider {
  quote(order: OrderPayload): Promise<number>;
  dispatch(order: OrderPayload): Promise<DispatchResult>;
  verifyWebhook(signature: string, payload: any): boolean;
  parseWebhook(payload: any): TrackingUpdate | null;
}

