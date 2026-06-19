-- infra/seed.sql
--
-- Minimal, deterministic seed so the negotiation → order loop runs end-to-end
-- the moment the schema is applied. One Lagos fashion merchant (the BIBLO
-- archetype), a small catalog, pricing rules, and one customer linked to the
-- merchant. Re-runnable: every insert is ON CONFLICT DO NOTHING / idempotent.
--
-- Apply AFTER schema.sql:
--     psql "$DATABASE_URL" -f infra/schema.sql
--     psql "$DATABASE_URL" -f infra/seed.sql
--
-- Fixed UUID for the demo merchant so seed + links + rules always agree.

-- ── Merchant ─────────────────────────────────────────────────────────────────
-- tone_guide / business_policies / delivery_info / dialect are injected into the
-- negotiator's system prompt — this is the "seller context" the AI speaks from.
insert into merchants (
  id, name, phone_number_id,
  tone_guide, business_policies, delivery_info, dialect,
  whatsapp_catalog_id, default_discount_pct
) values (
  '11111111-1111-1111-1111-111111111111',
  'Amaka Fashion House',
  '109876543210987',                       -- demo WhatsApp Business phone_number_id
  'Warm, relationship-first Lagos market trader. Friendly, never pushy. ' ||
    'Calls regulars by name, sprinkles light Pidgin ("o", "abeg", "sharp sharp").',
  'Minimum order ₦5,000. No returns on sale items; exchanges within 3 days on ' ||
    'full-price items with tags intact. Open Mon–Sat, 9am–7pm. ' ||
    'Bulk/aso-ebi orders (5+ pieces) need 50% deposit upfront.',
  'Delivery: Lagos Mainland ₦2,000 (same/next day), Lagos Island ₦3,500 ' ||
    '(1–2 days), nationwide via GIG Logistics ₦4,500+ (3–5 days). ' ||
    'Pickup free at Yaba shop.',
  'pidgin',
  '1234567890',                            -- demo Meta commerce catalog id
  0
)
on conflict (id) do nothing;

-- ── Pricing rules (one row per merchant) ─────────────────────────────────────
-- absolute_floor is the hard backstop; the per-tier maps are the soft ceilings.
-- These mirror the README's "Customer Tier × Negotiation Authority" table.
insert into merchant_pricing_rules (
  merchant_id, base_price, absolute_floor,
  max_discount_by_tier, max_bundle_value_add_by_tier, future_credit_cap_by_tier
) values (
  '11111111-1111-1111-1111-111111111111',
  0,                                       -- base_price is per-product (from check_inventory)
  10000,                                   -- ₦10,000 absolute hard floor across the shop
  '{"new":0.05,"returning":0.15,"loyal":0.22,"vip":0.30}',
  '{"new":0,"returning":0.10,"loyal":0.20,"vip":0.30}',
  '{"new":0,"returning":1000,"loyal":2500,"vip":5000}'
)
on conflict (merchant_id) do nothing;

-- ── Catalog (deep product context) ───────────────────────────────────────────
-- `stock` deliberately spans the scarcity threshold (<= 5) so the
-- scarcity_signal tactic is exercisable on ANK-BLU-001 but not on the others.
-- description/category/tags/attributes give the AI real material to describe and
-- bundle on, instead of only discounting.
insert into products
  (sku, merchant_id, name, stock, price, description, category, tags, attributes, image_url) values
  (
    'ANK-BLU-001', '11111111-1111-1111-1111-111111111111', 'Blue Ankara Gown', 3, 28500,
    'Floor-length blue Ankara gown in 100% cotton wax. Fitted bodice, flared skirt, ' ||
      'hidden side zip. Handmade by our Yaba tailors — runs true to size.',
    'Ankara',
    '["wedding-guest","ankara","blue","floor-length","handmade"]',
    '{"sizes":["S","M","L","XL"],"color":"royal blue","material":"100% cotton wax","fit":"true to size"}',
    'https://cdn.example.com/ace/products/ank-blu-001.jpg'
  ),
  (
    'ANK-RED-002', '11111111-1111-1111-1111-111111111111', 'Red Ankara Two-Piece', 24, 32000,
    'Two-piece red Ankara set: cropped peplum top + wrap maxi skirt. ' ||
      'Great for owambe and aso-ebi groups.',
    'Ankara',
    '["aso-ebi","two-piece","red","owambe","peplum"]',
    '{"sizes":["S","M","L","XL","XXL"],"color":"red","material":"cotton wax","pieces":2}',
    'https://cdn.example.com/ace/products/ank-red-002.jpg'
  ),
  (
    'HWR-GLD-010', '11111111-1111-1111-1111-111111111111', 'Gold Gele Head Wrap', 40, 6500,
    'Stiff metallic gold gele, 2 yards. Pairs with most Ankara and lace. ' ||
      'The natural upsell with any gown.',
    'Accessories',
    '["gele","gold","headwrap","accessory","aso-ebi"]',
    '{"length_yards":2,"color":"gold","material":"metallic jacquard"}',
    'https://cdn.example.com/ace/products/hwr-gld-010.jpg'
  ),
  (
    'SHO-BLK-021', '11111111-1111-1111-1111-111111111111', 'Black Beaded Heels', 12, 18000,
    'Hand-beaded black block heels, 3-inch. Comfortable for all-day owambe.',
    'Footwear',
    '["heels","black","beaded","block-heel","comfortable"]',
    '{"sizes":["37","38","39","40","41","42"],"heel_inches":3,"color":"black"}',
    'https://cdn.example.com/ace/products/sho-blk-021.jpg'
  )
on conflict (sku, merchant_id) do nothing;

-- ── Customer ↔ merchant link (Phase-1 identity resolution) ───────────────────
-- The customer_id is the customer's WhatsApp phone in E.164. Swap in your own
-- test number so inbound webhooks from that number resolve to this merchant.
insert into customer_merchant_links (customer_id, merchant_id)
values ('2348012345678', '11111111-1111-1111-1111-111111111111')
on conflict (customer_id, merchant_id) do nothing;

-- ── (Optional) Backfill a delivered order to exercise tier resolution ────────
-- Uncomment to make 2348012345678 a "returning" customer (lifetimeValue 28500,
-- 1 delivered order → still "new" with 1 order; add more rows to climb tiers).
-- insert into orders (id, merchant_id, customer_id, state)
-- values (
--   '22222222-2222-2222-2222-222222222222',
--   '11111111-1111-1111-1111-111111111111',
--   '2348012345678',
--   '{"status":"delivered","orderId":"22222222-2222-2222-2222-222222222222","items":[{"sku":"ANK-BLU-001","name":"Blue Ankara Gown","quantity":1,"unitPrice":28500}],"total":28500,"deliveredAt":1718000000000}'
-- )
-- on conflict (id) do nothing;
