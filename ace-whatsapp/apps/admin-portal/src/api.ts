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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
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
};
