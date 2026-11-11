import axios from 'axios';
import Constants from 'expo-constants';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

// Dynamically extract the Metro packager host IP that the mobile device is connected to
function resolveApiUrl(): string {
  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).manifest2?.extra?.expoClient?.hostUri;

    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:3004`;
      }
    }

    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }

    return 'http://192.168.1.149:3004';
  }

  return process.env.EXPO_PUBLIC_API_URL || 'https://api.biblio.africa';
}

export const API_URL = resolveApiUrl();
console.log('====================================================');
console.log('[Biblio-API] Target Backend Base URL:', API_URL);
console.log('====================================================');

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Intercept requests to dynamically inject the active auth token and log traffic
api.interceptors.request.use((config) => {
  console.log(`[Biblio-API-Req] -> ${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url}`, config.data ? JSON.stringify(config.data) : '');
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    // Phase 2 transition fallback if backend still expects x-api-key for admin testing
    config.headers['x-admin-key'] = token; 
  }
  return config;
}, (error) => {
  console.error('[Biblio-API-Req-Error]', error);
  return Promise.reject(error);
});

// Intercept responses to handle 401 Unauthorized session invalidation and log responses
api.interceptors.response.use(
  (response) => {
    console.log(`[Biblio-API-Res] <- ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const errorData = error?.response?.data || error?.message;
    console.error(`[Biblio-API-Res-Error] <- ${status || 'ERR'} ${error.config?.url}:`, errorData);
    if (status === 401) {
      const { token, logout } = useAuthStore.getState();
      if (token) {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

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
      try {
        const res = await api.get(`/merchants/${merchantId}/products`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
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
      const res = await api.delete(`/merchants/${encodeURIComponent(merchantId || '')}/products/${encodeURIComponent(sku)}`);
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
      const res = await api.patch(`/merchants/${encodeURIComponent(merchantId || '')}/products/${encodeURIComponent(sku)}`, data);
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
      try {
        const res = await api.get(`/merchants/${merchantId}/chats`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
  });
};
// --- CUSTOMERS ---
export const useCustomers = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['customers', merchantId],
    queryFn: async () => {
      try {
        const res = await api.get(`/merchants/${merchantId}/customers`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
  });
};

// --- INBOX ---
export const useInbox = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['inboxCards', merchantId],
    queryFn: async () => {
      try {
        const res = await api.get(`/merchants/${merchantId}/inbox`);
        if (Array.isArray(res.data)) {
          return res.data;
        }
        if (res.data && Array.isArray((res.data as any).cards)) {
          return (res.data as any).cards;
        }
        return [];
      } catch (err) {
        console.warn('Failed to fetch inbox cards:', err);
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
  });
};

export const useExecuteInboxAction = () => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async ({ cardId, action, payload }: { cardId: string, action: 'approve' | 'reject' | 'snooze', payload?: any }) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId || '')}/inbox/${encodeURIComponent(cardId)}/execute`, { action, payload });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inboxCards', merchantId] });
    },
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

export interface QuarantineRecord {
  id: string;
  merchant_id: string;
  contact_raw_phone: string;
  sender_name: string | null;
  trigger_message: string;
  confidence_score: number;
  intent_detected: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export const useQuarantineChats = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery<QuarantineRecord[]>({
    queryKey: ['quarantineChats', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const res = await api.get(`/merchants/${merchantId}/quarantine`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!merchantId,
    refetchInterval: 5000,
  });
};

export const useResolveQuarantine = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      quarantineId,
      action,
      draftText,
    }: {
      quarantineId: string;
      action: 'reply_as_biblio' | 'draft_for_me' | 'ignore';
      draftText?: string;
    }) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId || '')}/quarantine/${encodeURIComponent(quarantineId)}/resolve`, {
        action,
        draftText,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarantineChats', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['agentMessages', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['inboxCards', merchantId] });
    },
  });
};


export function useSearchData(id: string, q: string) {
  return useQuery({
    queryKey: ['search', id, q],
    queryFn: async () => {
      try {
        if (!q || q.length < 2) return [];
        const { data } = await api.get(`/merchants/${encodeURIComponent(id)}/search?q=${encodeURIComponent(q)}`);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!id && q.length >= 2,
    initialData: [],
  });
}


export const useChatDetails = (customerId: string) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery({
    queryKey: ['chat', merchantId, customerId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${encodeURIComponent(merchantId || '')}/chats/${encodeURIComponent(customerId)}`);
      return res.data;
    },
    enabled: !!merchantId && !!customerId,
  });
};

export const useTakeoverChat = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (customerId: string) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId || '')}/chats/${encodeURIComponent(customerId)}/takeover`);
      return res.data;
    }
  });
};

export const useReleaseTakeoverChat = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (customerId: string) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId || '')}/chats/${encodeURIComponent(customerId)}/release-takeover`);
      return res.data;
    }
  });
};

export const useSendChatMessage = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async ({ customerId, text }: { customerId: string, text: string }) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId || '')}/chats/${encodeURIComponent(customerId)}/send`, { text });
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
      try {
        const res = await api.get(`/merchants/${merchantId}/suppliers`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
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
      const res = await api.patch(`/merchants/${encodeURIComponent(merchantId || '')}/suppliers/${encodeURIComponent(id)}`, data);
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
      const res = await api.delete(`/merchants/${encodeURIComponent(merchantId || '')}/suppliers/${encodeURIComponent(id)}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers', merchantId] }),
  });
};

export const usePairWhatsApp = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await api.post('/pair', { phoneNumber, merchantId });
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

export interface StatusCandidate {
  sku: string;
  name: string;
  price: number;
  image_url?: string;
  margin_pct: number;
  recent_sales_velocity: number;
  promotion_score: number;
  last_posted_at?: string;
}

export interface StatusCandidatesResponse {
  ok: boolean;
  candidates: StatusCandidate[];
  strategy?: string;
  marginWeight?: number;
  velocityWeight?: number;
}

export const useStatusCandidates = (limit = 5) => {
  const merchantId = useAuthStore((state) => state.merchantId);
  return useQuery<StatusCandidatesResponse>({
    queryKey: ['statusCandidates', merchantId, limit],
    queryFn: async () => {
      try {
        const res = await api.get(`/merchants/${merchantId}/status-candidates?limit=${limit}`);
        if (res.data && Array.isArray(res.data.candidates)) {
          return res.data;
        }
        if (Array.isArray(res.data)) {
          return { ok: true, candidates: res.data };
        }
        return { ok: true, candidates: [] };
      } catch (e) {
        return { ok: false, candidates: [] };
      }
    },
    enabled: !!merchantId,
    initialData: { ok: true, candidates: [] },
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
      try {
        const res = await api.get(`/merchants/${merchantId}/status-log?limit=${limit}`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
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
      try {
        const res = await api.get(`/merchants/${merchantId}/support-tickets`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
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
      if (!merchantId) return [];
      const res = await api.get(`/merchants/${merchantId}/agent-messages`);
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!merchantId,
    staleTime: 3000,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  });
};

export const useSendAgentMessage = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      text,
      imageUrl,
      imageBase64,
      attachmentType,
    }: {
      text?: string;
      imageUrl?: string;
      imageBase64?: string;
      attachmentType?: string;
    }) => {
      const res = await api.post(`/merchants/${merchantId}/agent-messages`, {
        text: text || '',
        imageUrl,
        imageBase64,
        attachmentType,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentMessages', merchantId] });
    },
  });
};

export const useSendAgentAudio = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      audioBase64,
      mimeType,
      durationSeconds,
    }: {
      audioBase64: string;
      mimeType?: string;
      durationSeconds?: number;
    }) => {
      const res = await api.post(`/merchants/${merchantId}/agent-audio`, {
        audioBase64,
        mimeType: mimeType || 'audio/m4a',
        durationSeconds,
      });
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
      try {
        const res = await api.get(`/merchants/${merchantId}/disputes`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
  });
};

export const useResolveDispute = () => {
  const merchantId = useAuthStore((state) => state.merchantId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ disputeId, decision, note }: { disputeId: string; decision: 'approve' | 'reject'; note?: string }) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId || '')}/disputes/${encodeURIComponent(disputeId)}/resolve`, { decision, note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes', merchantId] });
      queryClient.invalidateQueries({ queryKey: ['inboxCards', merchantId] });
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
  inMemory?: boolean;
  isPairing?: boolean;
  lastError?: string | null;
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
      try {
        const res = await api.get('/vendors');
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    initialData: [],
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
      try {
        const res = await api.get(`/vendors/${targetId}/queue`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!targetId,
    initialData: [],
  });
};

export const useApproveVendorQueueItem = (vendorId?: string) => {
  const queryClient = useQueryClient();
  const merchantId = useAuthStore((state) => state.merchantId);
  const targetId = vendorId || merchantId;
  return useMutation({
    mutationFn: async (queueId: string) => {
      const res = await api.post(`/vendors/${encodeURIComponent(targetId || '')}/queue/${encodeURIComponent(queueId)}/approve`);
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
      const res = await api.post(`/chats/${encodeURIComponent(chatId)}/hands-off`, { merchantId, handsOff });
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
      try {
        if (!merchantId) return [];
        const res = await api.get(`/merchants/${merchantId}/veto/actions`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!merchantId,
    initialData: [],
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

// 5. In-App Account Deletion (App Store 5.1.1(v) Compliant)
export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: async ({ merchantId, confirmation }: { merchantId: string; confirmation: string }) => {
      const res = await api.post(`/merchants/${merchantId}/delete-account`, { confirmation });
      return res.data;
    },
  });
};

// --- AUTONOMOUS VOICE CALLING & PROXY DIALING ---
export interface VoiceConfigData {
  enabled: boolean;
  approvalMode: 'require_approval' | 'fully_autonomous';
  callOnOrderConfirmation: boolean;
  callOnPendingPayment: boolean;
  callOnHighValue: boolean;
  highValueThreshold: number;
  callOnRiderDispatch: boolean;
  voicePersona: 'warm_nigerian_english' | 'pidgin_blend' | 'formal_corporate';
  customScriptTemplate?: string;
}

export interface QueuedVoiceCallData {
  queueId: string;
  merchantId: string;
  merchantName: string;
  toPhone: string;
  purpose: string;
  scriptPreview: string;
  orderTotal?: number;
  status: 'pending_approval' | 'approved' | 'rejected';
  createdAt: string;
}

export const useVoiceConfig = (merchantId: string) => {
  return useQuery<{ ok: boolean; config: VoiceConfigData }>({
    queryKey: ['voiceConfig', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/voice-config`);
      return res.data;
    },
    enabled: Boolean(merchantId),
  });
};

export const useUpdateVoiceConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, data }: { merchantId: string; data: Partial<VoiceConfigData> }) => {
      const res = await api.put(`/merchants/${merchantId}/voice-config`, data);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['voiceConfig', vars.merchantId] });
    },
  });
};

export const useVoiceQueue = (merchantId: string) => {
  return useQuery<{ ok: boolean; count: number; queue: QueuedVoiceCallData[] }>({
    queryKey: ['voiceQueue', merchantId],
    queryFn: async () => {
      const res = await api.get(`/merchants/${merchantId}/voice-queue`);
      return res.data;
    },
    enabled: Boolean(merchantId),
    refetchInterval: 8000,
  });
};

export const useApproveVoiceCall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, queueId }: { merchantId: string; queueId: string }) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId)}/voice-queue/${encodeURIComponent(queueId)}/approve`);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['voiceQueue', vars.merchantId] });
      queryClient.invalidateQueries({ queryKey: ['voiceCalls', vars.merchantId] });
    },
  });
};

export const useRejectVoiceCall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ merchantId, queueId }: { merchantId: string; queueId: string }) => {
      const res = await api.post(`/merchants/${encodeURIComponent(merchantId)}/voice-queue/${encodeURIComponent(queueId)}/reject`);
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['voiceQueue', vars.merchantId] });
    },
  });
};

export const useVoiceCallPreview = () => {
  return useMutation({
    mutationFn: async ({
      merchantId,
      purpose,
      orderTotal,
      deliveryAddress,
      voicePersona,
    }: {
      merchantId: string;
      purpose: string;
      orderTotal?: number;
      deliveryAddress?: string;
      voicePersona?: string;
    }) => {
      const res = await api.post(`/merchants/${merchantId}/voice-preview`, {
        purpose,
        orderTotal,
        deliveryAddress,
        voicePersona,
      });
      return res.data;
    },
  });
};

export const useTriggerVoiceCall = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      merchantId,
      toPhone,
      purpose,
      orderTotal,
      deliveryAddress,
      forceImmediate,
    }: {
      merchantId: string;
      toPhone: string;
      purpose: string;
      orderTotal?: number;
      deliveryAddress?: string;
      forceImmediate?: boolean;
    }) => {
      const res = await api.post(`/merchants/${merchantId}/voice-call`, {
        toPhone,
        purpose,
        orderTotal,
        deliveryAddress,
        forceImmediate,
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['voiceQueue', vars.merchantId] });
      queryClient.invalidateQueries({ queryKey: ['voiceCalls', vars.merchantId] });
    },
  });
};





