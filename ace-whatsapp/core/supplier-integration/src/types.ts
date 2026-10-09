export type ChannelType = 'whatsapp_group' | 'whatsapp_direct' | 'telegram_channel' | 'ig_dm';

export interface ProcurementNode {
  id: string;
  merchantId: string;
  name: string;
  channelType: ChannelType;
  channelId: string;
  categories: string[];
  autoRestockEnabled: boolean;
  createdAt: Date;
}

export interface RestockRequest {
  sku: string;
  quantityNeeded: number;
  urgency: 'low' | 'high';
}
