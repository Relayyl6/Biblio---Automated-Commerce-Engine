// Tests for the pure Meta-catalog → ACE product mapper: price parsing across
// Meta's many formats, stock resolution from inventory/availability, and the
// rule that a half-defined node (no sku/name/price) is dropped rather than
// creating a broken, unsellable product row.

import { describe, it, expect } from "vitest";
import { mapCatalogProduct, mapCatalogPage, parsePrice } from "./catalogMapper";

describe("parsePrice", () => {
  it.each([
    ["₦28,500.00", false, 28500],
    ["28500 NGN", false, 28500],
    ["28,500", false, 28500],
    [28500, false, 28500],
    ["₦1,234.56", false, 1234.56],
  ] as const)("parses %s → %i", (raw, minor, expected) => {
    expect(parsePrice(raw, minor)).toBe(expected);
  });

  it("treats integers as kobo when minorUnits is set", () => {
    expect(parsePrice(2850000, true)).toBe(28500);
    expect(parsePrice("2850000", true)).toBe(28500);
  });

  it("returns null for unusable input", () => {
    expect(parsePrice(undefined, false)).toBeNull();
    expect(parsePrice("", false)).toBeNull();
    expect(parsePrice("₦", false)).toBeNull();
    expect(parsePrice(".", false)).toBeNull();
    expect(parsePrice(Number.NaN, false)).toBeNull();
  });
});

describe("mapCatalogProduct", () => {
  const base = {
    retailer_id: "BLK-001",
    name: "Black Lace Gown",
    price: "₦15,000.00",
    currency: "NGN",
    availability: "in stock",
    inventory: 5,
    image_url: "https://x/img.jpg",
    category: "dresses",
    description: "Evening wear",
  };

  it("maps a complete node to a normalized row", () => {
    expect(mapCatalogProduct(base)).toEqual({
      sku: "BLK-001",
      name: "Black Lace Gown",
      price: 15000,
      stock: 5,
      description: "Evening wear",
      category: "dresses",
      imageUrl: "https://x/img.jpg",
      currency: "NGN",
    });
  });

  it("falls back to id when retailer_id is absent", () => {
    const { retailer_id, ...rest } = base;
    expect(mapCatalogProduct({ ...rest, id: "FB-99" })?.sku).toBe("FB-99");
  });

  it("defaults currency to NGN when missing", () => {
    const { currency, ...rest } = base;
    expect(mapCatalogProduct(rest)?.currency).toBe("NGN");
  });

  it.each([
    ["no sku", { name: "x", price: "100" }],
    ["no name", { retailer_id: "S", price: "100" }],
    ["no price", { retailer_id: "S", name: "x" }],
  ])("drops a node with %s (returns null)", (_label, node) => {
    expect(mapCatalogProduct(node)).toBeNull();
  });
});

describe("resolveStock (via mapCatalogProduct)", () => {
  it("uses the explicit inventory count, floored and clamped at 0", () => {
    expect(mapCatalogProduct({ retailer_id: "S", name: "x", price: "100", inventory: 7.9 })?.stock).toBe(7);
    expect(mapCatalogProduct({ retailer_id: "S", name: "x", price: "100", inventory: -3 })?.stock).toBe(0);
  });

  it("uses defaultStock for in-stock products without an inventory count", () => {
    const p = mapCatalogProduct(
      { retailer_id: "S", name: "x", price: "100", availability: "in stock" },
      { defaultStock: 100 },
    );
    expect(p?.stock).toBe(100);
  });

  it("treats out-of-stock as 0 regardless of defaultStock", () => {
    const p = mapCatalogProduct(
      { retailer_id: "S", name: "x", price: "100", availability: "out of stock" },
      { defaultStock: 100 },
    );
    expect(p?.stock).toBe(0);
  });
});

describe("mapCatalogPage", () => {
  it("maps the valid nodes and silently drops the unmappable ones", () => {
    const page = mapCatalogPage([
      { retailer_id: "A", name: "Alpha", price: "1000" },
      { name: "no sku", price: "1000" }, // dropped
      { retailer_id: "B", name: "Beta", price: "2000" },
    ]);
    expect(page.map((p) => p.sku)).toEqual(["A", "B"]);
  });
});