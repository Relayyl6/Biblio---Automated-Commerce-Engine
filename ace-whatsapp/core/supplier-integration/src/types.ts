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

export interface InventoryItem {
  id: string;
  merchantId: string;
  sku: string;
  name: string;
  stockQuantity: number;
  reorderThreshold: number;
  reorderBatchSize: number;
  supplierId?: string;
}

export interface Supplier {
  id: string;
  merchantId: string;
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  preferredChannel?: string;
}

export interface RestockDraft {
  id: string;
  merchantId: string;
  supplierId: string;
  inventoryItemId: string;
  proposedQuantity: number;
  messageDraft: string;
  status: string;
  createdAt: string;
}
