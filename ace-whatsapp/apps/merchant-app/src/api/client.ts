// merchant-app/src/api/client.ts
//
// Typed client for the merchant-api (core/merchant-api). The app NEVER touches
// Postgres directly — it goes through this REST surface, the same one the
// admin-portal uses. Keeping all network shape in one file means screens stay
// declarative and the API contract has a single source of truth.

import Constants from "expo-constants";

const BASE_URL: string =
  (Constants.expoConfig?.extra?.merchantApiBaseUrl as string) ?? "http://localhost:3004";

// Optional admin key — only needed if the API was started with ADMIN_API_KEY.
const API_KEY: string | undefined = Constants.expoConfig?.extra?.adminApiKey as
  | string
  | undefined;

export type Dialect = "pidgin" | "yoruba" | "igbo" | "hausa" | "english";

export interface Merchant {
  id: string;
  name: string;
  phone_number_id: string;
  tone_guide: string | null;
  business_policies: string | null;
  delivery_info: string | null;
  dialect: Dialect;
  whatsapp_catalog_id: string | null;
}

export interface Product {
  sku: string;
  name: string;
  stock: number;
  price: number;
  description: string | null;
  category: string | null;
  tags: string[];
  attributes: Record<string, unknown>;
  image_url: string | null;
  currency: string;
  active: boolean;
  source: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  // Some endpoints return no body.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  getMerchant: (id: string) => request<Merchant>(`/merchants/${id}`),

  updateMerchant: (id: string, patch: Partial<Merchant>) =>
    request<{ ok: true }>(`/merchants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(toApi(patch)),
    }),

  listProducts: (merchantId: string) =>
    request<Product[]>(`/merchants/${merchantId}/products`),

  upsertProduct: (merchantId: string, p: Partial<Product> & { sku: string; name: string; price: number }) =>
    request<{ ok: true; sku: string }>(`/merchants/${merchantId}/products`, {
      method: "POST",
      body: JSON.stringify(toApi(p)),
    }),

  deleteProduct: (merchantId: string, sku: string) =>
    request<{ ok: true }>(`/merchants/${merchantId}/products/${sku}`, { method: "DELETE" }),

  syncCatalog: (merchantId: string) =>
    request<{ ok: true; fetched: number; upserted: number }>(
      `/merchants/${merchantId}/catalog-sync`,
      { method: "POST" },
    ),
};

// The API speaks camelCase in request bodies; the rows it returns are snake_case
// (raw Postgres). This maps the editable fields back to the request shape.
function toApi(v: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    tone_guide: "toneGuide",
    business_policies: "businessPolicies",
    delivery_info: "deliveryInfo",
    whatsapp_catalog_id: "whatsappCatalogId",
    image_url: "imageUrl",
  };
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[map[k] ?? k] = val;
  return out;
}
