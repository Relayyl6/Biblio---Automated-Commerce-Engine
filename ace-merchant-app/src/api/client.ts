import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

// Fallback to local Wi-Fi IP so physical device always reaches backend on LAN
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.104.150.253:3004';

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


