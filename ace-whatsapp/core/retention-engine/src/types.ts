export interface AtRiskCustomer {
  customerId: string;
  merchantId: string;
  contactPhone: string;
  lastOrderDate: string;
  totalOrders: number;
  lifetimeValue: number;
  daysSinceLastOrder: number;
}

export interface WinbackDraft {
  id: string;
  merchantId: string;
  customerId: string;
  proposedDiscountPercent: number;
  messageDraft: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'sent';
  createdAt: string;
}

export interface PricingRule {
  merchantId: string;
  maxDiscountPercent: number;
  minMarginPercent: number;
}
