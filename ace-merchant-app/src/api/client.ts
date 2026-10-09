import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

// Strict environment variable implementation for Expo
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3004';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
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
      const res = await api.get(\/merchants/\/suppliers\);
      return res.data;
    },
    enabled: !!merchantId,
  });
};
