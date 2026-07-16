// admin-portal/src/api.ts — typed client for core/merchant-api.
declare const __MERCHANT_API__: string;

const BASE = __MERCHANT_API__;
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY as string | undefined;

export interface Merchant {
  id: string;
  name: string;
  phone_number_id: string;
  tone_guide: string | null;
  business_policies: string | null;
  delivery_info: string | null;
  dialect: string;
  whatsapp_catalog_id: string | null;
}

export interface Product {
  sku: string;
  name: string;
  stock: number;
  price: number;
  category: string | null;
  active: boolean;
  source: string;
}

export interface Vendor {
  vendorId: string;
  businessLineNumber: string | null;
  dbStatus: string;
  inMemory?: boolean;
}

export interface StatusLogEntry {
  sku: string;
  product_name: string | null;
  image_url: string | null;
  caption: string | null;
  posted_at: string;
}

export interface QueueItem {
  id: string;
  sku: string;
  product_name: string | null;
  image_url: string | null;
  caption: string | null;
  queued_at: string;
  approved_at: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("ace_admin_token");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => "")}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  getMerchant: (id: string) => req<Merchant>(`/merchants/${id}`),
  createMerchant: (body: {
    name: string;
    phoneNumberId: string;
    toneGuide?: string;
    dialect?: string;
    whatsappCatalogId?: string;
  }) => req<{ id: string }>(`/merchants`, { method: "POST", body: JSON.stringify(body) }),
  listProducts: (id: string) => req<Product[]>(`/merchants/${id}/products`),
  syncCatalog: (id: string) =>
    req<{ ok: true; fetched: number; upserted: number }>(`/merchants/${id}/catalog-sync`, {
      method: "POST",
    }),
  // Vendor / Baileys business line
  createVendor: (body: { merchantId: string; personalNumber: string }) =>
    req<{ vendorId: string }>(`/vendors`, { method: "POST", body: JSON.stringify(body) }),
  pairVendor: (vendorId: string, phoneNumber: string) => {
    return req<{ ok: boolean; code?: string; error?: string }>(`/vendors/${vendorId}/pair`, {
      method: "POST",
      body: JSON.stringify({ phoneNumber })
    });
  },
  triggerStatusCron: () => {
    return fetch(`http://localhost:3005/status/cron`, { method: "POST" })
      .then(r => r.json()) as Promise<{ ok: boolean }>;
  },
  getVendorStatus: (vendorId: string) => req<Vendor>(`/vendors/${vendorId}/status`),
  getStatusLog: (vendorId: string, limit = 20) =>
    req<StatusLogEntry[]>(`/vendors/${vendorId}/status-log?limit=${limit}`),
  getQueue: (vendorId: string) => req<QueueItem[]>(`/vendors/${vendorId}/queue`),
  approveQueueItem: (vendorId: string, queueId: string) =>
    req<{ ok: true }>(`/vendors/${vendorId}/queue/${queueId}/approve`, { method: "POST" }),
  updateVendorSettings: (vendorId: string, settings: {
    autoStatusEnabled?: boolean;
    postingFrequencyHours?: number;
    approveBeforePost?: boolean;
  }) => req<{ ok: true }>(`/vendors/${vendorId}/settings`, { method: "PATCH", body: JSON.stringify(settings) }),
};
