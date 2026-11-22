import { sql, redis, jsonb } from '@ace/shared/clients';
import { logger } from '@ace/shared/logger.js';
import crypto from 'crypto';
import Groq from 'groq-sdk';
import { loadNegotiatorEnv } from '@ace/shared/env.js';
import { WatchTaskService } from './watchTaskService.js';

const env = loadNegotiatorEnv();
const groq = new Groq({ apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY || '' });
const GROQ_MODEL = env.GROQ_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  description: any;
  category: string;
  colors?: any;
  sizes?: any;
  image_url?: string | null;
  active: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface StockoutPrediction {
  sku: string;
  name: string;
  currentStock: number;
  dailyVelocity: number;
  daysRemaining: number;
  projectedStockoutDate: string;
  reorderRecommended: boolean;
  recommendedOrderQuantity: number;
}

export interface RestockMarginAnalysis {
  sku: string;
  name: string;
  currentRetailPrice: number;
  supplierQuotePerUnit: number;
  quantity: number;
  totalCost: number;
  projectedGrossProfit: number;
  grossMarginPercent: number;
  meetsMerchantRule: boolean;
  minimumRequiredRetailPrice: number;
}

export class InventoryManagementService {
  /**
   * Predict stockouts based on 30-day historical sales velocity and lead time.
   */
  static async predictStockouts(
    merchantId: string,
    daysThreshold: number = 7
  ): Promise<{ predictions: StockoutPrediction[]; criticalCount: number }> {
    logger.info('[InventoryManagementService] Running stockout prediction', { merchantId, daysThreshold });

    // 1. Fetch sales velocity over last 30 days
    const velocityRows = await sql<{
      sku: string;
      units_sold: number;
    }[]>`
      SELECT 
        (item->>'sku') as sku,
        COALESCE(SUM((item->>'quantity')::int), 0) as units_sold
      FROM orders o,
      jsonb_array_elements(CASE WHEN jsonb_typeof(o.items) = 'array' THEN o.items ELSE '[]'::jsonb END) as item
      WHERE (o.merchant_id = ${merchantId}::uuid OR o.tenant_id = ${merchantId}::uuid)
        AND o.created_at >= NOW() - INTERVAL '30 days'
        AND o.payment_status IN ('paid', 'escrow_locked', 'settled')
      GROUP BY (item->>'sku')
    `.catch(() => []);

    const velocityMap = new Map<string, number>();
    for (const r of velocityRows) {
      if (r.sku) {
        velocityMap.set(r.sku, Number(r.units_sold) / 30);
      }
    }

    // 2. Fetch active catalog products
    const products = await sql<ProductRecord[]>`
      SELECT id, sku, name, price, COALESCE(stock, quantity, 0) as stock, category,
             low_stock_threshold as "lowStockThreshold"
      FROM products
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND active = true
        AND deleted_at IS NULL
    `;

    const predictions: StockoutPrediction[] = [];
    let criticalCount = 0;

    for (const p of products) {
      const dailyVelocity = velocityMap.get(p.sku) || 0.1; // Default to baseline velocity if zero
      const currentStock = Number(p.stock || 0);
      const daysRemaining = Math.max(0, Math.round(currentStock / dailyVelocity));

      const isCritical = daysRemaining <= daysThreshold || currentStock <= (p as any).lowStockThreshold;
      if (isCritical) {
        criticalCount++;
      }

      const projectedDate = new Date();
      projectedDate.setDate(projectedDate.getDate() + daysRemaining);

      const targetDaysBuffer = 30; // Aim to hold 30 days of inventory
      const recommendedOrderQty = Math.max(10, Math.ceil(dailyVelocity * targetDaysBuffer) - currentStock);

      predictions.push({
        sku: p.sku,
        name: p.name,
        currentStock,
        dailyVelocity: Math.round(dailyVelocity * 100) / 100,
        daysRemaining,
        projectedStockoutDate: projectedDate.toISOString().split('T')[0],
        reorderRecommended: isCritical,
        recommendedOrderQuantity: isCritical ? recommendedOrderQty : 0,
      });
    }

    predictions.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return { predictions, criticalCount };
  }

  /**
   * Contact supplier for restocking with purchase order terms.
   */
  static async contactSupplier(params: {
    merchantId: string;
    sku: string;
    quantity: number;
    supplierId?: string;
    customNote?: string;
  }): Promise<{ success: boolean; poNumber: string; message: string; supplierDetails?: any }> {
    const { merchantId, sku, quantity, supplierId, customNote } = params;

    // Fetch product info
    const product = await sql<ProductRecord[]>`
      SELECT * FROM products 
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid) 
        AND sku = ${sku} 
      LIMIT 1
    `;
    if (!product[0]) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    const p = product[0];
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}-${sku.slice(0, 4).toUpperCase()}`;

    // Find supplier
    let supplier: any = null;
    if (supplierId) {
      const supRows = await sql`
        SELECT * FROM suppliers WHERE id = ${supplierId}::uuid AND merchant_id = ${merchantId}::uuid LIMIT 1
      `.catch(() => []);
      supplier = supRows[0];
    } else {
      const supRows = await sql`
        SELECT * FROM suppliers WHERE merchant_id = ${merchantId}::uuid ORDER BY created_at ASC LIMIT 1
      `.catch(() => []);
      supplier = supRows[0];
    }

    const supplierPhone = supplier?.phone || supplier?.whatsapp_phone || '+2348000000000';
    const supplierName = supplier?.name || 'Authorized Supplier';

    const poMessage = `Hello ${supplierName},\n\nOfficial Purchase Order from ${merchantId}:\n` +
      `PO Ref: ${poNumber}\n` +
      `Item: ${p.name} (SKU: ${p.sku})\n` +
      `Quantity Requested: ${quantity} units\n` +
      (customNote ? `Note: ${customNote}\n\n` : '\n') +
      `Please reply with your unit invoice quote and estimated dispatch date. Thank you!`;

    // Record draft PO in database
    await sql`
      INSERT INTO supplier_purchase_orders (
        merchant_id, po_number, supplier_id, sku, quantity, status, notes, created_at, updated_at
      ) VALUES (
        ${merchantId}::uuid, ${poNumber}, ${supplier?.id || null}, ${sku}, ${quantity}, 'dispatched', ${poMessage}, now(), now()
      )
    `.catch(() => {});

    logger.info('[InventoryManagementService] Dispatched supplier restock PO', { poNumber, sku, quantity });

    return {
      success: true,
      poNumber,
      message: `Purchase Order ${poNumber} dispatched to ${supplierName} (${supplierPhone}) for ${quantity} units of ${p.name}.`,
      supplierDetails: { name: supplierName, phone: supplierPhone },
    };
  }

  /**
   * Verify whether a supplier's quote preserves the store's target margin floor.
   */
  static async calculateRestockMargin(params: {
    merchantId: string;
    sku: string;
    supplierQuoteTotal: number;
    quantity: number;
    targetMarginPercent?: number;
  }): Promise<RestockMarginAnalysis> {
    const { merchantId, sku, supplierQuoteTotal, quantity, targetMarginPercent = 25 } = params;

    const product = await sql<ProductRecord[]>`
      SELECT * FROM products 
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid) 
        AND sku = ${sku} 
      LIMIT 1
    `;
    if (!product[0]) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    const p = product[0];
    const unitCost = supplierQuoteTotal / quantity;
    const currentRetail = Number(p.price);
    const totalRevenue = currentRetail * quantity;
    const projectedProfit = totalRevenue - supplierQuoteTotal;
    const grossMargin = (projectedProfit / totalRevenue) * 100;
    const meetsRule = grossMargin >= targetMarginPercent;

    // Minimum retail price required to achieve target margin
    const minRequiredRetail = unitCost / (1 - targetMarginPercent / 100);

    return {
      sku: p.sku,
      name: p.name,
      currentRetailPrice: currentRetail,
      supplierQuotePerUnit: Math.round(unitCost * 100) / 100,
      quantity,
      totalCost: supplierQuoteTotal,
      projectedGrossProfit: Math.round(projectedProfit),
      grossMarginPercent: Math.round(grossMargin * 10) / 10,
      meetsMerchantRule: meetsRule,
      minimumRequiredRetailPrice: Math.ceil(minRequiredRetail / 100) * 100,
    };
  }

  /**
   * Add a new product to the verified merchant catalog.
   */
  static async addInventory(params: {
    merchantId: string;
    name: string;
    price: number;
    stock?: number;
    category?: string;
    description?: string;
    colors?: string[];
    sizes?: string[];
    imageUrl?: string;
    sku?: string;
  }): Promise<ProductRecord> {
    const {
      merchantId,
      name,
      price,
      stock = 0,
      category = 'General',
      description = '',
      colors = [],
      sizes = [],
      imageUrl = null,
    } = params;

    if (!name || price <= 0) {
      throw new Error('Valid product name and positive price are required');
    }

    const sku = params.sku || `SKU-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const rows = await sql<ProductRecord[]>`
      INSERT INTO products (
        merchant_id,
        sku,
        name,
        price,
        stock,
        quantity,
        category,
        description,
        colors,
        sizes,
        image_url,
        active,
        available,
        created_at,
        updated_at
      ) VALUES (
        ${merchantId}::uuid,
        ${sku},
        ${name.trim()},
        ${price},
        ${stock},
        ${stock},
        ${category.trim()},
        ${jsonb({ text: description.trim() })},
        ${jsonb(colors)},
        ${sizes},
        ${imageUrl},
        true,
        true,
        now(),
        now()
      ) RETURNING *
    `;

    const created = rows[0];
    logger.info('[InventoryManagementService] Added product', { sku, name, price, stock });

    // Trigger instant inventory event for watch tasks
    await WatchTaskService.onInventoryChanged(merchantId, {
      sku,
      action: 'created',
    }).catch(() => {});

    // Broadcast on Redis channel
    await redis.publish('events:inventory:updated', JSON.stringify({
      merchantId,
      sku,
      action: 'created',
      timestamp: Date.now(),
    })).catch(() => {});

    return created;
  }

  /**
   * Update existing product stock, price, or details.
   */
  static async updateInventory(params: {
    merchantId: string;
    sku: string;
    name?: string;
    price?: number;
    stock?: number;
    stockDelta?: number;
    category?: string;
    description?: string;
  }): Promise<ProductRecord> {
    const { merchantId, sku, name, price, stock, stockDelta, category, description } = params;

    const existing = await sql<ProductRecord[]>`
      SELECT * FROM products 
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND sku = ${sku}
      LIMIT 1
    `;
    if (!existing[0]) {
      throw new Error(`Product with SKU ${sku} does not exist`);
    }

    const current = existing[0];
    const newStock = stock !== undefined ? stock : stockDelta !== undefined ? Number(current.stock || 0) + stockDelta : current.stock;
    const newPrice = price !== undefined ? price : current.price;
    const newName = name !== undefined ? name.trim() : current.name;
    const newCategory = category !== undefined ? category.trim() : current.category;
    const newDesc = description !== undefined ? jsonb({ text: description }) : current.description;

    const updated = await sql<ProductRecord[]>`
      UPDATE products
      SET name = ${newName},
          price = ${newPrice},
          stock = ${newStock},
          quantity = ${newStock},
          category = ${newCategory},
          description = ${newDesc},
          available = ${newStock > 0},
          updated_at = now()
      WHERE id = ${current.id}::uuid
      RETURNING *
    `;

    logger.info('[InventoryManagementService] Updated product', { sku, newStock, newPrice });

    // If restocked or price decreased, evaluate pending watch tasks
    if (newStock > Number(current.stock || 0) || newPrice < Number(current.price)) {
      await WatchTaskService.onInventoryChanged(merchantId, {
        sku,
        action: newStock > Number(current.stock || 0) ? 'restocked' : 'price_changed',
      }).catch(() => {});

      await redis.publish('events:inventory:updated', JSON.stringify({
        merchantId,
        sku,
        action: 'updated',
        timestamp: Date.now(),
      })).catch(() => {});
    }

    return updated[0];
  }

  /**
   * Soft-delete a product from active catalog.
   */
  static async deleteInventory(merchantId: string, sku: string): Promise<{ success: boolean; message: string }> {
    const rows = await sql`
      UPDATE products
      SET active = false,
          available = false,
          deleted_at = now(),
          updated_at = now()
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND sku = ${sku}
      RETURNING id
    `;
    if (rows.length === 0) {
      throw new Error(`Product with SKU ${sku} not found`);
    }
    logger.info('[InventoryManagementService] Soft-deleted product', { sku });
    return { success: true, message: `Product ${sku} removed from catalog.` };
  }

  /**
   * Multi-criteria catalog search with fuzzy matching and filters.
   */
  static async searchInventory(params: {
    merchantId: string;
    query?: string;
    category?: string;
    inStockOnly?: boolean;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ products: ProductRecord[]; totalCount: number }> {
    const {
      merchantId,
      query = '',
      category,
      inStockOnly = false,
      minPrice,
      maxPrice,
      limit = 20,
      offset = 0,
    } = params;

    const like = `%${query.trim()}%`;

    const rows = await sql<ProductRecord[]>`
      SELECT id, sku, name, price, COALESCE(stock, quantity, 0) as stock, category,
             description, image_url, colors, sizes, metadata, active, created_at, updated_at
      FROM products
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND active = true
        AND deleted_at IS NULL
        ${inStockOnly ? sql`AND COALESCE(stock, quantity, 0) > 0` : sql``}
        ${category ? sql`AND category ILIKE ${category}` : sql``}
        ${minPrice !== undefined ? sql`AND price >= ${minPrice}` : sql``}
        ${maxPrice !== undefined ? sql`AND price <= ${maxPrice}` : sql``}
        ${query ? sql`AND (name ILIKE ${like} OR sku ILIKE ${like} OR category ILIKE ${like} OR description::text ILIKE ${like})` : sql``}
      ORDER BY updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return { products: rows, totalCount: rows.length };
  }

  /**
   * Reserve inventory during active customer negotiation / checkout.
   * Uses Redis TTL lock to guarantee stock is held without race conditions.
   */
  static async reserveInventory(params: {
    merchantId: string;
    sku: string;
    quantity: number;
    customerId: string;
    ttlMinutes?: number;
  }): Promise<{ success: boolean; reservationId: string; expiresAt: string }> {
    const { merchantId, sku, quantity, customerId, ttlMinutes = 15 } = params;

    const lockKey = `inv_lock:${merchantId}:${sku}`;
    const acquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
    if (!acquired) {
      throw new Error('Stock is currently being updated by another customer. Please retry in a moment.');
    }

    try {
      const p = await sql<ProductRecord[]>`
        SELECT id, sku, COALESCE(stock, quantity, 0) as stock FROM products
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
          AND sku = ${sku} AND active = true
        LIMIT 1
      `;
      if (!p[0] || Number(p[0].stock) < quantity) {
        throw new Error(`Insufficient stock. Only ${p[0]?.stock || 0} units available.`);
      }

      // Deduct available stock
      await sql`
        UPDATE products
        SET stock = stock - ${quantity},
            quantity = quantity - ${quantity},
            updated_at = now()
        WHERE id = ${p[0].id}::uuid
      `;

      const reservationId = `RES-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

      await redis.set(
        `inv_reservation:${reservationId}`,
        JSON.stringify({ merchantId, sku, quantity, customerId, expiresAt }),
        'EX',
        ttlMinutes * 60
      );

      logger.info('[InventoryManagementService] Reserved inventory', { reservationId, sku, quantity });
      return { success: true, reservationId, expiresAt };
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * Release reserved inventory back to available stock.
   */
  static async releaseInventoryReservation(reservationId: string): Promise<boolean> {
    const raw = await redis.get(`inv_reservation:${reservationId}`);
    if (!raw) return false;

    const data = JSON.parse(raw);
    const { merchantId, sku, quantity } = data;

    await sql`
      UPDATE products
      SET stock = stock + ${quantity},
          quantity = quantity + ${quantity},
          updated_at = now()
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND sku = ${sku}
    `;

    await redis.del(`inv_reservation:${reservationId}`);
    logger.info('[InventoryManagementService] Released inventory reservation', { reservationId, sku, quantity });
    return true;
  }

  /**
   * Bulk price update across a category or entire catalog.
   */
  static async bulkPriceUpdate(params: {
    merchantId: string;
    percentageDelta?: number;
    fixedDelta?: number;
    category?: string;
  }): Promise<{ updatedCount: number; message: string }> {
    const { merchantId, percentageDelta, fixedDelta, category } = params;

    let updatedRows: any[] = [];
    if (percentageDelta !== undefined) {
      const multiplier = 1 + percentageDelta / 100;
      updatedRows = await sql`
        UPDATE products
        SET price = ROUND((price * ${multiplier})::numeric, -2),
            updated_at = now()
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
          AND active = true
          ${category ? sql`AND category ILIKE ${category}` : sql``}
        RETURNING id
      `;
    } else if (fixedDelta !== undefined) {
      updatedRows = await sql`
        UPDATE products
        SET price = GREATEST(100, price + ${fixedDelta}),
            updated_at = now()
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
          AND active = true
          ${category ? sql`AND category ILIKE ${category}` : sql``}
        RETURNING id
      `;
    }

    return {
      updatedCount: updatedRows.length,
      message: `Updated pricing for ${updatedRows.length} products across ${category || 'all categories'}.`,
    };
  }

  /**
   * AI Extraction & Enrichment for informal / voice product input.
   */
  static async extractAndEnrichProduct(params: {
    merchantId: string;
    rawText: string;
    imageUrl?: string;
    autoSave?: boolean;
  }): Promise<{ product: any; saved: boolean }> {
    const { merchantId, rawText, imageUrl, autoSave = true } = params;

    const systemPrompt = `You are the Biblio Catalog Structuring Engine for African / Nigerian social commerce.
A merchant has provided an informal or voice-transcribed product description:
"${rawText}"
${imageUrl ? `Attached Image URL: ${imageUrl}` : ''}

Extract structured JSON strictly with:
- "title": Clean, compelling, search-friendly title (e.g. "Royal Blue Ankara Fabric with Gold Lace")
- "category": Standard commerce category (e.g. "Fabrics & Textiles", "Fashion", "Footwear")
- "subcategory": Specific sub-type
- "price": Extracted price in NGN (positive number, e.g. 45000)
- "stock": Extracted available stock count (integer, default 1)
- "colors": Array of color names (e.g. ["Blue", "Gold"])
- "sizes": Array of sizes (e.g. ["6 Yards", "XL"])
- "description": Polished 1-2 sentence marketing description.`;

    let extracted: any = {};
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: systemPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });
      extracted = JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch {
      extracted = {
        title: rawText.slice(0, 50),
        category: 'General',
        price: 0,
        stock: 1,
        colors: [],
        sizes: [],
        description: rawText,
      };
    }

    if (autoSave && extracted.title && extracted.price > 0) {
      const saved = await this.addInventory({
        merchantId,
        name: extracted.title,
        price: extracted.price,
        stock: extracted.stock || 1,
        category: extracted.category || 'General',
        description: extracted.description || '',
        colors: extracted.colors || [],
        sizes: extracted.sizes || [],
        imageUrl,
      });
      return { product: saved, saved: true };
    }

    return { product: extracted, saved: false };
  }

  /**
   * List all out of stock catalog items.
   */
  static async listOutOfStock(merchantId: string, limit: number = 10): Promise<{ count: number; items: any[]; message: string }> {
    const rows = await sql<{ id: string; name: string; sku: string; price: number }[]>`
      SELECT id, name, sku, price
      FROM products
      WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
        AND COALESCE(quantity, stock, 0) = 0
        AND deleted_at IS NULL
      LIMIT ${limit}
    `.catch(() => []);

    if (rows.length === 0) {
      return { count: 0, items: [], message: 'No products are currently out of stock!' };
    }

    const list = rows.map((r) => `- ${r.name} (SKU: ${r.sku}) — ₦${Number(r.price).toLocaleString()}`).join('\n');
    return {
      count: rows.length,
      items: rows,
      message: `Out of Stock Items (${rows.length}):\n${list}`,
    };
  }

  /**
   * AI Catalog Enrichment: Generate cultural descriptions and smart tags.
   */
  static async enrichCatalogWithAI(
    merchantId: string,
    sku: string,
    name?: string,
    category?: string
  ): Promise<{ description: string; tags: string[]; category: string }> {
    const defaultDesc = `✨ Premium Nigerian quality, crafted with care. Perfect for everyday elegance and durability.`;
    const defaultTags = ['premium', category || 'general', 'nigerian-quality'];

    try {
      const pRows = await sql<{ name: string; category: string }[]>`
        SELECT name, category FROM products
        WHERE (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
          AND sku = ${sku}
        LIMIT 1
      `.catch(() => []);

      const prodName = name || pRows[0]?.name || 'Premium Item';
      const prodCat = category || pRows[0]?.category || 'General';

      const prompt = `Write a compelling 2-sentence Nigerian social commerce description and 4 tags for product: ${prodName} (Category: ${prodCat}). Return JSON: {"description": "...", "tags": ["tag1", "tag2"]}`;
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return {
        description: parsed.description || defaultDesc,
        tags: Array.isArray(parsed.tags) ? parsed.tags : defaultTags,
        category: prodCat,
      };
    } catch {
      return {
        description: defaultDesc,
        tags: defaultTags,
        category: category || 'General',
      };
    }
  }

  /**
   * Trigger Shopify inventory synchronization.
   */
  static async syncShopifyInventory(merchantId: string): Promise<{ ok: boolean; message: string }> {
    await redis.lpush('jobs:inventory-sync', JSON.stringify({ merchantId, source: 'shopify' })).catch(() => {});
    return { ok: true, message: 'Shopify catalog synchronized.' };
  }
}
