import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

// Production API endpoint with environment override
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? (typeof window !== 'undefined' && window.location ? `http://${window.location.hostname}:3004` : 'http://10.91.190.253:3004')
    : 'https://api.biblio.africa');

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Intercept requests to dynamically inject the active auth token
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    // Phase 2 transition fallback if backend still expects x-api-key for admin testing
    config.headers['x-admin-key'] = token; 
  }
  return config;
});

// --- TELEMETRY / PULSE ---
export const usePulseData = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['pulse', merchantId],
    queryFn: async () => {
      const res = await api.get('/telemetry/dashboard');
      return res.data;
    },
    enabled: !!merchantId,
  });
};

// --- PRODUCTS / CRM ---
export const useProducts = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['products', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/products`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useAddProduct = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/merchants/${merchantId}/products`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', merchantId] }),
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (sku: string) => {
      const res = await api.delete(`/merchants/${merchantId}/products/${sku}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', merchantId] }),
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async ({
      sku,
      ...data
    }: {
      sku: string;
      name?: string;
      price?: number;
      stock?: number;
      category?: string;
      imageUrl?: string;
      active?: boolean;
    }) => {
      const res = await api.patch(`/merchants/${merchantId}/products/${sku}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', merchantId] }),
  });
};

export const useSyncWhatsAppCatalog = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/merchants/${merchantId}/catalog-sync`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', merchantId] }),
  });
};

// --- VENDOR CONFIG ---
export const useMerchantConfig = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['merchant', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useUpdateMerchantConfig = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.patch(`/merchants/${merchantId}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });
};

// --- CHATS / INBOX ---
export const useChats = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['chats', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/chats`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};
// --- CUSTOMERS ---
export const useCustomers = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['customers', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/customers`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

// --- INBOX ---
export const useInbox = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['inboxCards', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/inbox`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useExecuteInboxAction = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async ({ cardId, action, payload }: { cardId: string, action: 'approve' | 'reject' | 'snooze', payload?: any }) => {
      const res = await api.post(`/merchants/${merchantId}/inbox/${cardId}/execute`, { action, payload });
      return res.data;
    }
  });
};

export const useSeedInboxCards = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/merchants/${merchantId}/inbox/sample`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxCards', merchantId] });
    },
  });
};

export const useFinanceData = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['finance', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/finance`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};


export function useSearchData(id: string, q: string) {
  return useQuery({
    queryKey: ['search', id, q],
    queryFn: async () => {
      if (!q || q.length < 2) return [];
      const { data } = await api.get(`/merchants/${id}/search?q=${encodeURIComponent(q)}`);
      return data;
    },
    enabled: !!id && q.length >= 2
  });
}


export const useChatDetails = (customerId: string) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['chat', merchantId, customerId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/chats/${customerId}`);
      return res.data;
    },
    enabled: !!merchantId && !!customerId,
  });
};

export const useTakeoverChat = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (customerId: string) => {
      const res = await api.post(`/merchants/${merchantId}/chats/${customerId}/takeover`);
      return res.data;
    }
  });
};

export const useReleaseTakeoverChat = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (customerId: string) => {
      const res = await api.post(`/merchants/${merchantId}/chats/${customerId}/release-takeover`);
      return res.data;
    }
  });
};

export const useSendChatMessage = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async ({ customerId, text }: { customerId: string, text: string }) => {
      const res = await api.post(`/merchants/${merchantId}/chats/${customerId}/send`, { text });
      return res.data;
    }
  });
};

// --- SUPPLIERS / PROCUREMENT NODES ---
export const useSuppliers = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['suppliers', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/suppliers`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useAddSupplier = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post(`/merchants/${merchantId}/suppliers`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers', merchantId] }),
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await api.patch(`/merchants/${merchantId}/suppliers/${id}`, data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers', merchantId] }),
  });
};

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/merchants/${merchantId}/suppliers/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers', merchantId] }),
  });
};

export const usePairWhatsApp = () => {
  return useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await api.post('/pair', { phoneNumber });
      return res.data;
    }
  });
};

// --- WHATSAPP STATUS AUTOMATION & SMART RANKING ---
export const useStatusSettings = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['statusSettings', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/status-settings`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useUpdateStatusSettings = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (data: {
      autoStatusEnabled?: boolean;
      postingFrequencyHours?: number;
      approveBeforePost?: boolean;
      statusStrategy?: 'balanced' | 'margin_priority' | 'velocity_priority' | 'freshness';
      marginWeight?: number;
      velocityWeight?: number;
    }) => {
      const res = await api.patch(`/merchants/${merchantId}/status-settings`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statusSettings', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['statusCandidates', merchantId] });
    },
  });
};

export const useStatusCandidates = (limit = 5) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['statusCandidates', merchantId, limit],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/status-candidates?limit=${limit}`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const usePostStatusNow = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (sku?: string) => {
      const res = await api.post(`/merchants/${merchantId}/status-post-now`, { sku });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statusCandidates', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['statusLog', merchantId] });
    },
  });
};

export const useStatusLog = (limit = 10) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['statusLog', merchantId, limit],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/status-log?limit=${limit}`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

// --- NOTIFICATION HISTORY & AUDIT PIPELINE ---
export interface NotificationEvent {
  id: string;
  title: string;
  body: string;
  channel: 'whatsapp' | 'push' | 'sms' | 'in-app';
  status: 'delivered' | 'pending' | 'failed';
  timestamp: string;
  metadata?: Record<string, any>;
}

export const useNotificationHistory = (limit = 50) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['notificationHistory', merchantId, limit],
    queryFn: async (): Promise<{ ok: boolean; count: number; events: NotificationEvent[] }> => {
      const res = await api.get(`/merchants/${merchantId}/notification-history?limit=${limit}`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useClearNotificationHistory = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/merchants/${merchantId}/notification-history`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.setQueryData(['notificationHistory', merchantId, 50], { ok: true, count: 0, events: [] });
    },
  });
};

// --- SUPPORT TICKETING PIPELINE ---
export interface SupportTicketInput {
  subject: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
}

export const useSubmitSupportTicket = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (data: SupportTicketInput) => {
      const res = await api.post(`/merchants/${merchantId}/support-tickets`, data);
      return res.data;
    },
  });
};

export const useSupportTickets = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['supportTickets', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/support-tickets`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export interface AgentMessage {
  id: string;
  channel: 'whatsapp' | 'in_app';
  sender_role: 'vendor' | 'agent' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

export const useAgentMessages = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery<AgentMessage[]>({
    queryKey: ['agentMessages', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/agent-messages`);
      return res.data;
    },
    enabled: !!merchantId,
    refetchInterval: 3000,
  });
};

export const useSendAgentMessage = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ text, imageUrl }: { text: string; imageUrl?: string }) => {
      const res = await api.post(`/merchants/${merchantId}/agent-messages`, { text, imageUrl });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentMessages', merchantId] });
    },
  });
};

export interface DisputeItem {
  id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  refund_amount_ngn: number;
  status: 'pending_review' | 'approved' | 'rejected';
  created_at: string;
  resolved_at?: string;
  order_state?: any;
}

export const useDisputes = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery<DisputeItem[]>({
    queryKey: ['disputes', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/disputes`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useResolveDispute = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ disputeId, decision, note }: { disputeId: string; decision: 'approve' | 'reject'; note?: string }) => {
      const res = await api.post(`/merchants/${merchantId}/disputes/${disputeId}/resolve`, { decision, note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['inbox', merchantId] });
    },
  });
};

// --- MERCHANT INTEGRATIONS & API KEYS ---
export type MerchantTier = 'starter' | 'growth' | 'enterprise';
export type CredentialStatus = 'custom_override' | 'managed_pool' | 'unconfigured';

export interface MerchantIntegrationsData {
  subscriptionTier?: MerchantTier;
  canEditCustomKeys?: boolean;
  tierRequirements?: Record<string, string>;
  dispatch: {
    gokada: string;
    hasGokada: boolean;
    statusGokada?: CredentialStatus;
    hasPlatformDefaultGokada?: boolean;

    kwik: string;
    hasKwik: boolean;
    statusKwik?: CredentialStatus;
    hasPlatformDefaultKwik?: boolean;

    max: string;
    hasMax: boolean;
    statusMax?: CredentialStatus;
    hasPlatformDefaultMax?: boolean;

    sendstack: string;
    hasSendstack: boolean;
    statusSendstack?: CredentialStatus;
    hasPlatformDefaultSendstack?: boolean;
  };
  developer: {
    groq: string;
    hasGroq: boolean;
    statusGroq?: CredentialStatus;
    hasPlatformDefaultGroq?: boolean;

    twilioSid: string;
    hasTwilioSid: boolean;
    statusTwilioSid?: CredentialStatus;
    hasPlatformDefaultTwilioSid?: boolean;

    twilioAuth: string;
    hasTwilioAuth: boolean;
    statusTwilioAuth?: CredentialStatus;
    hasPlatformDefaultTwilioAuth?: boolean;

    paystack: string;
    hasPaystack: boolean;
    statusPaystack?: CredentialStatus;
    hasPlatformDefaultPaystack?: boolean;

    africasTalking: string;
    hasAfricasTalking: boolean;
    statusAfricasTalking?: CredentialStatus;
    hasPlatformDefaultAfricasTalking?: boolean;
  };
  fulfillment: {
    supportsPickup: boolean;
    pickupAddress: string;
  };
}

export const useMerchantIntegrations = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery<MerchantIntegrationsData>({
    queryKey: ['merchantIntegrations', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/integrations`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useUpdateMerchantIntegrations = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      dispatch?: {
        gokada?: string;
        kwik?: string;
        max?: string;
        sendstack?: string;
      };
      developer?: {
        groq?: string;
        twilioSid?: string;
        twilioAuth?: string;
        paystack?: string;
        africasTalking?: string;
      };
      fulfillment?: {
        supportsPickup?: boolean;
        pickupAddress?: string;
      };
    }) => {
      const res = await api.patch(`/merchants/${merchantId}/integrations`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchantIntegrations', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });
};

export const useUpdateSubscriptionTier = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tier: MerchantTier) => {
      if (tier === 'growth' || tier === 'enterprise') {
        const res = await api.post(`/merchants/${merchantId}/billing/upgrade`, {
          targetTier: tier,
          paymentMethod: 'admin_grant',
        });
        return res.data;
      }
      const res = await api.patch(`/merchants/${merchantId}`, { subscriptionTier: tier });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchantIntegrations', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['merchantFeatures', merchantId] });
    },
  });
};

export interface FeatureEntitlement {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'growth' | 'enterprise';
  requiredTier: MerchantTier;
  isAllowed: boolean;
}

export const useMerchantFeatures = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery<{
    merchantId: string;
    currentTier: MerchantTier;
    entitlements: FeatureEntitlement[];
  }>({
    queryKey: ['merchantFeatures', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/features`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

// --- BANK ACCOUNT ONBOARDING (PAYSTACK NUBAN ESCROW PAYOUTS) ---
export const useUpdateBankAccount = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      accountNumber: string;
      bankCode: string;
      accountName: string;
    }) => {
      const res = await api.post(`/merchants/${merchantId}/bank-account`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['finance', merchantId] });
    },
  });
};

// --- PRICING RULES (NEGOTIATION AUTHORITY) ---
export interface PricingRulesInput {
  basePrice?: number;
  absoluteFloor: number;
  maxDiscountByTier?: Record<string, number>;
  maxBundleValueAddByTier?: Record<string, number>;
  futureCreditCapByTier?: Record<string, number>;
}

export const useUpdatePricingRules = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PricingRulesInput) => {
      const res = await api.put(`/merchants/${merchantId}/pricing-rules`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant', merchantId] });
    },
  });
};

// --- PLATFORM MASTER CREDENTIALS (ADMIN CONTROL PLANE) ---
export interface AdminPlatformCredential {
  provider: string;
  maskedKey: string;
  isActive: boolean;
  description: string | null;
  updatedAt: string | null;
}

export const useAdminPlatformCredentials = () => {
  return useQuery<{ credentials: AdminPlatformCredential[] }>({
    queryKey: ['adminPlatformCredentials'],
    queryFn: async () => {
      const res = await api.get('/admin/platform-credentials');
      return res.data;
    },
  });
};

export const useUpdateAdminPlatformCredential = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      provider: string;
      apiKey: string;
      secretKey?: string;
      description?: string;
    }) => {
      const res = await api.patch('/admin/platform-credentials', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPlatformCredentials'] });
    },
  });
};

// --- ADMIN TELEMETRY FINANCIALS (GMV, ESCROW, AI COST ATTRIBUTION) ---
export const useAdminTelemetryFinancials = () => {
  return useQuery({
    queryKey: ['adminTelemetryFinancials'],
    queryFn: async () => {
      const res = await api.get('/admin/telemetry/financials');
      return res.data;
    },
  });
};

// --- VENDOR & BAILEYS WHATSAPP SESSION STATUS ---
export interface VendorStatusData {
  vendorId: string;
  businessLineNumber: string | null;
  dbStatus: string;
  connected?: boolean;
  state?: string;
  [key: string]: any;
}

export const useVendorStatus = (vendorId?: string) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const targetId = vendorId || merchantId;
  return useQuery<VendorStatusData>({
    queryKey: ['vendorStatus', targetId],
    queryFn: async () => {
      const res = await api.get(`/vendors/${targetId}/status`);
      return res.data;
    },
    enabled: !!targetId,
    refetchInterval: 5000,
  });
};

export const useVendors = () => {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await api.get('/vendors');
      return res.data;
    },
  });
};

export const useCreateVendor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      merchantId: string;
      personalNumber: string;
      autoStatusEnabled?: boolean;
      postingFrequencyHours?: number;
      approveBeforePost?: boolean;
    }) => {
      const res = await api.post('/vendors', data);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });
};

export const useUpdateVendorSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vendorId,
      ...settings
    }: {
      vendorId: string;
      autoStatusEnabled?: boolean;
      postingFrequencyHours?: number;
      approveBeforePost?: boolean;
      statusStrategy?: string;
      marginWeight?: number;
      velocityWeight?: number;
    }) => {
      const res = await api.patch(`/vendors/${vendorId}/settings`, settings);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendorStatus', variables.vendorId] });
      queryClient.invalidateQueries({ queryKey: ['statusSettings'] });
    },
  });
};

export const useVendorQueue = (vendorId?: string) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const targetId = vendorId || merchantId;
  return useQuery({
    queryKey: ['vendorQueue', targetId],
    queryFn: async () => {
      const res = await api.get(`/vendors/${targetId}/queue`);
      return res.data;
    },
    enabled: !!targetId,
  });
};

export const useApproveVendorQueueItem = (vendorId?: string) => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  const targetId = vendorId || merchantId;
  return useMutation({
    mutationFn: async (queueId: string) => {
      const res = await api.post(`/vendors/${targetId}/queue/${queueId}/approve`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendorQueue', targetId] }),
  });
};

// --- CUSTOMER IDENTITY & RELATIONSHIP LINK ---
export const useLinkCustomer = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customerId: string) => {
      const res = await api.post(`/merchants/${merchantId}/customers`, { customerId });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers', merchantId] }),
  });
};

// --- AUTHENTICATION & LOGIN MUTATIONS ---
export const useMerchantLogin = () => {
  return useMutation({
    mutationFn: async (phone: string) => {
      const res = await api.post('/auth/merchant/login', { phone });
      return res.data;
    },
  });
};

export const useMerchantVerifyOtp = () => {
  return useMutation({
    mutationFn: async ({
      phone,
      code,
      firstName,
      lastName,
      dobMonth,
      dobDay,
      dobYear,
      businessName,
    }: {
      phone: string;
      code: string;
      firstName?: string;
      lastName?: string;
      dobMonth?: string;
      dobDay?: number;
      dobYear?: number;
      businessName?: string;
    }) => {
      const res = await api.post('/auth/merchant/verify', {
        phone,
        code,
        firstName,
        lastName,
        dobMonth,
        dobDay,
        dobYear,
        businessName,
      });
      return res.data;
    },
  });
};

export const useFinishProfile = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      dobMonth: string;
      dobDay: number;
      dobYear: number;
      businessName?: string;
    }) => {
      const res = await api.post('/auth/merchant/finish-profile', {
        merchantId,
        ...data,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchantConfig', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['pulse', merchantId] });
    },
  });
};

export const usePasswordLogin = () => {
  return useMutation({
    mutationFn: async ({ phone, password }: { phone: string; password: string }) => {
      const res = await api.post('/auth/login', { phone, password });
      return res.data;
    },
  });
};

// --- SYSTEM HEALTH & ADMIN TOKENS ---
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.get('/health');
      return res.data;
    },
  });
};

export const useIssueAdminToken = () => {
  return useMutation({
    mutationFn: async ({ merchantId, role }: { merchantId: string; role?: 'merchant' | 'admin' }) => {
      const res = await api.post('/auth/token', { merchantId, role });
      return res.data;
    },
  });
};

export const getGoogleOAuthUrl = (merchantId: string) => {
  return `${api.defaults.baseURL}/oauth/google?merchantId=${encodeURIComponent(merchantId)}`;
};

// ==========================================
// BUILD BRIEF v7 HOOKS
// ==========================================

// 1. Vendor Presence & Availability
export interface PresenceStateData {
  state: 'present' | 'delayed' | 'away' | 'off';
  sla_minutes: number;
  read_grace_minutes: number;
  cover_me: boolean;
  last_active_at: string;
  context_summary?: string;
}

export const useVendorPresence = (merchantId: string) => {
  return useQuery<PresenceStateData>({
    queryKey: ['vendorPresence', merchantId],
    queryFn: async () => {
      if (!merchantId) return { state: 'present', sla_minutes: 10, read_grace_minutes: 5, cover_me: false, last_active_at: new Date().toISOString() };
      const res = await api.get(`/merchants/${merchantId}/presence`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useUpdatePresence = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, data }: { merchantId: string; data: Partial<PresenceStateData> }) => {
      const res = await api.post(`/merchants/${merchantId}/presence`, data);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['vendorPresence', vars.merchantId] });
    },
  });
};

export const useCoverMe = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, enabled }: { merchantId: string; enabled: boolean }) => {
      const res = await api.post(`/merchants/${merchantId}/presence/cover-me`, { enabled });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['vendorPresence', vars.merchantId] });
    },
  });
};

export const useSetHandsOff = () => {
  return useMutation({
    mutationFn: async ({ chatId, merchantId, handsOff }: { chatId: string; merchantId: string; handsOff: boolean }) => {
      const res = await api.post(`/chats/${chatId}/hands-off`, { merchantId, handsOff });
      return res.data;
    },
  });
};

// 2. Tokens & Spend Caps
export interface TokenLedgerData {
  balance_tokens: number;
  balance_naira: number;
  daily_cap: number;
  monthly_cap: number;
  spent_today: number;
  spent_month: number;
  burn_rate_7d: number;
  usage_breakdown: {
    feature: string;
    tokens: number;
    naira: number;
    percentage: number;
  }[];
}

export const useTokens = (merchantId: string) => {
  return useQuery<TokenLedgerData>({
    queryKey: ['tokens', merchantId],
    queryFn: async () => {
      if (!merchantId) throw new Error('No merchant ID');
      const res = await api.get(`/merchants/${merchantId}/tokens`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useUpdateSpendCaps = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, dailyCap, monthlyCap }: { merchantId: string; dailyCap?: number; monthlyCap?: number }) => {
      const res = await api.post(`/merchants/${merchantId}/tokens/caps`, { dailyCap, monthlyCap });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tokens', vars.merchantId] });
    },
  });
};

export const useTopUpTokens = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, amountNaira }: { merchantId: string; amountNaira: number }) => {
      const res = await api.post(`/merchants/${merchantId}/tokens/top-up`, { amountNaira });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tokens', vars.merchantId] });
    },
  });
};

// 3. Veto Actions & Audit Logs
export interface VetoAuditItem {
  id: string;
  chat_id: string | null;
  action_type: string;
  blocked_by: string;
  reason: string;
  payload: any;
  created_at: string;
}

export const useVetoActions = (merchantId: string) => {
  return useQuery<VetoAuditItem[]>({
    queryKey: ['vetoActions', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const res = await api.get(`/merchants/${merchantId}/veto/actions`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useExecuteVetoAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      merchantId,
      chatId,
      actionType,
      blockedBy,
      reason,
      payload,
    }: {
      merchantId: string;
      chatId?: string;
      actionType: string;
      blockedBy: string;
      reason: string;
      payload?: any;
    }) => {
      const res = await api.post(`/merchants/${merchantId}/veto/action`, {
        chatId,
        actionType,
        blockedBy,
        reason,
        payload,
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['vetoActions', vars.merchantId] });
    },
  });
};

// 4. Soft Mode Quarantine & Resolution
export const useQuarantineChats = (merchantId: string) => {
  return useQuery({
    queryKey: ['quarantineChats', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const res = await api.get(`/merchants/${merchantId}/quarantine`);
      return res.data;
    },
    enabled: !!merchantId,
  });
};

export const useResolveChat = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chatId,
      merchantId,
      resolution,
    }: {
      chatId: string;
      merchantId: string;
      resolution: 'business' | 'personal' | 'ignore';
    }) => {
      const res = await api.post(`/chats/${chatId}/resolution`, { merchantId, resolution });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['quarantineChats', vars.merchantId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });
};

// 5. In-App Account Deletion (App Store 5.1.1(v) Compliant)
export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: async ({ merchantId, confirmation }: { merchantId: string; confirmation: string }) => {
      const res = await api.post(`/merchants/${merchantId}/delete-account`, { confirmation });
      return res.data;
    },
  });
};





