// core/catalog-sync/src/catalogMapper.ts
//
// Pure mapping from a Meta Commerce Catalog product node → an ACE `products`
// row. No I/O — index.ts fetches and upserts; this just translates the shape and
// normalizes Meta's quirks (price formatting, in/out-of-stock semantics) so the
// rest of the system never sees them. Same pure-module discipline as
// pricingService.ts / paymentService.ts.

/** A product node as returned by GET /{catalog_id}/products on the Graph API. */
export interface MetaCatalogProduct {
  id?: string;
  retailer_id?: string;        // the merchant's own SKU — our primary key
  name?: string;
  description?: string;
  price?: string | number;     // "₦28,500.00" | "28500 NGN" | 2850000 (minor units)
  currency?: string;           // "NGN"
  availability?: string;       // "in stock" | "out of stock" | "available for order"
  inventory?: number;          // exact stock when the merchant maintains it
  image_url?: string;
  category?: string;
}

/** The normalized row catalog-sync upserts into `products`. */
export interface MappedProduct {
  sku: string;
  name: string;
  price: number;               // whole NGN
  stock: number;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  currency: string;
}

export interface MapOptions {
  /** Treat numeric/`price` values as minor units (kobo) and divide by 100. */
  priceInMinorUnits?: boolean;
  /** Stock to assume when a product is "in stock" but exposes no inventory count. */
  defaultStock?: number;
}

/**
 * Map one catalog node. Returns null if it lacks the minimum we need (a SKU, a
 * name, and a usable price) — a half-defined catalog entry shouldn't create a
 * broken, unsellable product row.
 */
export function mapCatalogProduct(
  node: MetaCatalogProduct,
  opts: MapOptions = {},
): MappedProduct | null {
  const sku = nonEmpty(node.retailer_id) ?? nonEmpty(node.id);
  const name = nonEmpty(node.name);
  const price = parsePrice(node.price, opts.priceInMinorUnits ?? false);

  if (!sku || !name || price === null) return null;

  return {
    sku,
    name,
    price,
    stock: resolveStock(node, opts.defaultStock ?? 0),
    description: nonEmpty(node.description) ?? null,
    category: nonEmpty(node.category) ?? null,
    imageUrl: nonEmpty(node.image_url) ?? null,
    currency: nonEmpty(node.currency) ?? "NGN",
  };
}

/** Map a whole catalog page, dropping the entries that can't be mapped. */
export function mapCatalogPage(
  nodes: MetaCatalogProduct[],
  opts: MapOptions = {},
): MappedProduct[] {
  return nodes
    .map((n) => mapCatalogProduct(n, opts))
    .filter((p): p is MappedProduct => p !== null);
}

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveStock(node: MetaCatalogProduct, defaultStock: number): number {
  if (typeof node.inventory === "number" && Number.isFinite(node.inventory)) {
    return Math.max(0, Math.floor(node.inventory));
  }
  const avail = (node.availability ?? "").toLowerCase();
  const inStock = avail.includes("in stock") || avail.includes("available");
  return inStock ? defaultStock : 0;
}

/**
 * Parse Meta's price into whole NGN. Handles "₦28,500.00", "28500 NGN",
 * "28,500", and bare numbers. With priceInMinorUnits, an integer like 2850000
 * is treated as kobo → 28500.
 */
export function parsePrice(
  raw: string | number | undefined,
  minorUnits: boolean,
): number | null {
  if (raw === undefined || raw === null) return null;

  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else {
    // Strip currency symbols, codes, and thousands separators; keep one decimal.
    const cleaned = raw.replace(/[^0-9.]/g, "");
    if (cleaned === "" || cleaned === ".") return null;
    value = Number(cleaned);
  }
  if (!Number.isFinite(value)) return null;

  const ngn = minorUnits ? value / 100 : value;
  return Math.round(ngn * 100) / 100; // guard fp dust
}

function nonEmpty(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
