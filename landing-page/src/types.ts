export interface ChatMessage {
  id: string;
  sender: 'customer' | 'biblio';
  text: string;
  timestamp: string;
  isAudio?: boolean;
  audioDuration?: string;
  hasVanCard?: boolean;
  vanDetails?: {
    bank: string;
    accountNo: string;
    amount: string;
    expiresIn: string;
  };
  hasRiderCard?: boolean;
  riderDetails?: {
    courier: string;
    trackingId: string;
    eta: string;
  };
}

export interface PricingPlan {
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isPopular?: boolean;
  badge?: string;
  features: string[];
  ctaText: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
