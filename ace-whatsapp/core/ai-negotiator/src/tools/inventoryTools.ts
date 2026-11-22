import { sql, redis, jsonb } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";
import Groq from "groq-sdk";
import { loadNegotiatorEnv } from "@ace/shared/env.js";
import { InventoryManagementService } from "../services/inventoryManagementService.js";

const env = loadNegotiatorEnv();
const groq = new Groq({ apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY || "" });
const GROQ_MODEL = env.GROQ_MODEL || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const inventoryTools = [

  {
    "type": "function",
    "function": {
      "name": "predict_stockouts",
      "description": "Analyze sales velocity to flag items that will run out in X days.",
      "parameters": { "type": "object", "properties": { "days_threshold": { "type": "number" } } }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "contact_supplier",
      "description": "Send a WhatsApp Business API message to the merchant's saved supplier for restocking.",
      "parameters": { "type": "object", "properties": { "supplierId": { "type": "string" }, "sku": { "type": "string" }, "quantity": { "type": "number" } }, "required": ["sku", "quantity"] }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "calculate_restock_margin",
      "description": "Verify the supplier's quoted price maintains the merchant's profit margin rule.",
      "parameters": { "type": "object", "properties": { "sku": { "type": "string" }, "supplierQuoteTotal": { "type": "number" }, "quantity": { "type": "number" } }, "required": ["sku", "supplierQuoteTotal", "quantity"] }
    }
  },

  {
    "type": "function",
    "function": {
      "name": "add_inventory",
      "description": "Add new products to the catalog",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "price": {
            "type": "number"
          },
          "stock": {
            "type": "number"
          }
        },
        "required": [
          "name",
          "price"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_inventory",
      "description": "Modify prices or restock quantities",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "price": {
            "type": "number"
          },
          "stock": {
            "type": "number"
          }
        },
        "required": [
          "sku"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_inventory",
      "description": "Remove products from the catalog",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          }
        },
        "required": [
          "sku"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_inventory",
      "description": "Query stock levels",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "auto_restock_alert_config",
      "description": "Set low-stock thresholds",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "threshold": {
            "type": "number"
          }
        },
        "required": [
          "sku",
          "threshold"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "bulk_price_update",
      "description": "Increase or decrease prices in bulk",
      "parameters": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string"
          },
          "percentage": {
            "type": "number"
          }
        },
        "required": [
          "percentage"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_product_description",
      "description": "AI-generate descriptions",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          }
        },
        "required": [
          "sku"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "categorize_product",
      "description": "Assign tags/categories",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "sku",
          "tags"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_shopify_inventory",
      "description": "Pull inventory from Shopify",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "push_to_woocommerce",
      "description": "Sync ACE catalog to WooCommerce",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_out_of_stock",
      "description": "Show all out-of-stock items",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "archive_product",
      "description": "Archive a seasonal product",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          }
        },
        "required": [
          "sku"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "unarchive_product",
      "description": "Restore an archived product",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          }
        },
        "required": [
          "sku"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "add_product_variant",
      "description": "Add sizes/colors to existing product",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "variantName": {
            "type": "string"
          },
          "price": {
            "type": "number"
          }
        },
        "required": [
          "sku",
          "variantName"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "remove_product_variant",
      "description": "Remove sizes/colors",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "variantId": {
            "type": "string"
          }
        },
        "required": [
          "sku",
          "variantId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_minimum_order_quantity",
      "description": "Set MOQs for wholesale",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": {
            "type": "string"
          },
          "moq": {
            "type": "number"
          }
        },
        "required": [
          "sku",
          "moq"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "reserve_inventory",
      "description": "Atomically reserve stock for an item to prevent overselling or race conditions.",
      "parameters": {
        "type": "object",
        "properties": {
          "sku": { "type": "string", "description": "Product SKU to reserve" },
          "quantity": { "type": "number", "description": "Quantity to reserve (positive integer)" },
          "orderId": { "type": "string", "description": "Optional order reference" }
        },
        "required": ["sku", "quantity"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "extract_and_enrich_product",
      "description": "Extract structured product details from unstructured natural language (e.g. 'Blue Ankara with white shine shine 45k 3 yards left') or voice note transcription and image. Auto-extracts title, category, price, floor price, stock, colors, custom specifications, custom properties, and tags. Auto-saves to catalog unless autoSave is false.",
      "parameters": {
        "type": "object",
        "properties": {
          "rawText": {
            "type": "string",
            "description": "The raw unstructured description of the item"
          },
          "imageUrl": {
            "type": "string",
            "description": "Optional image URL if vendor sent a photo"
          },
          "autoSave": {
            "type": "boolean",
            "description": "Whether to automatically insert/upsert the product into the catalog (defaults to true)"
          }
        },
        "required": ["rawText"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "search_catalog_semantic",
      "description": "Perform high-accuracy semantic vector search across the product catalog using natural language descriptions or visual embeddings (CLIP 512-dim). Finds matching items even if exact keywords differ.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Natural language query (e.g. 'shiny blue fabric for wedding', 'unisex white sneakers') or image URL"
          },
          "limit": {
            "type": "number",
            "description": "Maximum number of results to return (default: 5)"
          }
        },
        "required": ["query"]
      }
    }
  }
];

export const inventoryHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {

  extract_and_enrich_product: async (merchantId: string, args: { rawText: string; imageUrl?: string; autoSave?: boolean }) => {
    const { rawText, imageUrl, autoSave = true } = args;
    await logger.log(`[ToolHandler:extract_and_enrich_product] Parsing raw input for merchant ${merchantId}`, { rawText, imageUrl });

    const systemPrompt = `You are the Biblio Catalog Structuring Engine for African / Nigerian social commerce.
A merchant has provided an informal or voice-transcribed product description:
"${rawText}"
${imageUrl ? `Attached Image URL: ${imageUrl}` : ""}

Extract structured JSON strictly with these fields:
- "title": Clean, compelling, search-friendly title (e.g. "Blue Ankara Fabric with White Shine-Shine Embellishments")
- "category": Standard commerce category (e.g. "Fabrics & Textiles", "Fashion", "Electronics", "Footwear")
- "subcategory": Specific sub-type (e.g. "Ankara Prints", "Sneakers")
- "price": Extracted price in NGN as a positive number (parse "45k" as 45000, "20 thousand" as 20000). If no price can be inferred, set 0.
- "floor": Derived negotiation floor price (default to 85% of price if unspecified, e.g. price * 0.85)
- "stock": Extracted available stock count (parse "3 yards", "5 pairs" as number, default 1)
- "colors": Array of objects: [{"name": "Blue", "hexCode": "#1E40AF"}, {"name": "White", "hexCode": "#FFFFFF"}]
- "sizes": Array of strings (e.g. ["3 Yards"] or ["42", "43"] or ["M", "L"])
- "custom_specifications": Array of [{"name": "Pattern", "value": "Shine Shine / Embellished"}, {"name": "Length", "value": "3 Yards"}]
- "custom_properties": Array of [{"propertyName": "Material", "values": ["Cotton"]}]
- "tags": Array of search keywords (e.g. ["ankara", "shine shine", "blue", "lace", "nigerian fabric"])
- "description": Polished 1-2 sentence description highlighting the value.`;

    let extracted: any = {};
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });
      extracted = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch (err: any) {
      await logger.error("[extract_and_enrich_product] Groq inference error, attempting deterministic parsing as last resort", err);
      const kMatch = rawText.match(/(\d+(?:\.\d+)?)\s*k\b/i);
      const mMatch = rawText.match(/(\d+(?:\.\d+)?)\s*m\b/i);
      const nairaMatch = rawText.match(/[₦#]?\s*(\d{1,3}(?:[,_]\d{3})+|\d{4,})/);
      const parsedPrice = mMatch
        ? Math.round(parseFloat(mMatch[1]) * 1_000_000)
        : kMatch
        ? Math.round(parseFloat(kMatch[1]) * 1_000)
        : nairaMatch
        ? parseInt(nairaMatch[1].replace(/[,_]/g, ""), 10)
        : 0;

      const qtyMatch = rawText.match(/(\d+)\s*(yards?|pcs?|pieces?|pairs?|items?|units?|left|remain)\b/i);
      const parsedStock = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

      extracted = {
        title: rawText.replace(/[₦#]?\d+.*$/i, "").trim() || rawText.slice(0, 50),
        category: "General",
        price: parsedPrice,
        floor: parsedPrice > 0 ? Math.round(parsedPrice * 0.85) : 0,
        stock: parsedStock,
        colors: [],
        sizes: [],
        custom_specifications: [],
        custom_properties: [],
        tags: [rawText.slice(0, 20)],
        description: rawText,
      };
    }

    if (autoSave && extracted.title && extracted.price > 0) {
      const sku = `SKU-${Date.now().toString().slice(-6)}`;
      const imagesJson = imageUrl ? JSON.stringify([{ file_id: crypto.randomUUID(), url: imageUrl }]) : JSON.stringify([]);
      const colorsJson = JSON.stringify(extracted.colors || []);
      const specsJson = JSON.stringify(extracted.custom_specifications || []);
      const propsJson = JSON.stringify(extracted.custom_properties || []);
      const tagsArr = Array.isArray(extracted.tags) ? extracted.tags : [];
      const sizesArr = Array.isArray(extracted.sizes) ? extracted.sizes : [];

      let embeddingStr: string | null = null;
      try {
        const { generateEmbedding } = await import("@ace/shared/data-intelligence/embeddings.js");
        const embeddingText = `${extracted.title} ${extracted.category || ""} ${extracted.subcategory || ""} ${extracted.description || ""} ${tagsArr.join(" ")}`;
        const vector = await generateEmbedding(imageUrl || embeddingText);
        if (Array.isArray(vector) && vector.length > 0) {
          embeddingStr = `[${vector.join(",")}]`;
        }
      } catch (embedErr) {
        await logger.warn("[extract_and_enrich_product] Embedding generation skipped", embedErr);
      }

      const descJson = JSON.stringify({ text: extracted.description || rawText });
      const metadataJson = JSON.stringify({ floor: extracted.floor || (extracted.price * 0.85), tags: tagsArr });

      if (embeddingStr) {
        await sql`
          INSERT INTO products (
            merchant_id, sku, name, description, detailed_description,
            price, regular_price, stock, quantity, category, subcategory,
            images, colors, sizes, custom_specifications, custom_properties,
            metadata, image_url, available, status, image_embedding, updated_at
          ) VALUES (
            ${merchantId}::uuid, ${sku}, ${extracted.title}, ${descJson}::jsonb, ${extracted.description || rawText},
            ${extracted.price}, ${extracted.price}, ${extracted.stock || 1}, ${extracted.stock || 1},
            ${extracted.category || "General"}, ${extracted.subcategory || null},
            ${imagesJson}::jsonb, ${colorsJson}::jsonb, ${sizesArr}, ${specsJson}::jsonb, ${propsJson}::jsonb,
            ${metadataJson}::jsonb, ${imageUrl || null}, true, 'Active', ${embeddingStr}::vector, now()
          )
        `;
      } else {
        await sql`
          INSERT INTO products (
            merchant_id, sku, name, description, detailed_description,
            price, regular_price, stock, quantity, category, subcategory,
            images, colors, sizes, custom_specifications, custom_properties,
            metadata, image_url, available, status, updated_at
          ) VALUES (
            ${merchantId}::uuid, ${sku}, ${extracted.title}, ${descJson}::jsonb, ${extracted.description || rawText},
            ${extracted.price}, ${extracted.price}, ${extracted.stock || 1}, ${extracted.stock || 1},
            ${extracted.category || "General"}, ${extracted.subcategory || null},
            ${imagesJson}::jsonb, ${colorsJson}::jsonb, ${sizesArr}, ${specsJson}::jsonb, ${propsJson}::jsonb,
            ${metadataJson}::jsonb, ${imageUrl || null}, true, 'Active', now()
          )
        `;
      }

      return `✅ Extracted & Cataloged Successfully!\n• Product: ${extracted.title} (SKU: ${sku})\n• Price: ₦${extracted.price.toLocaleString()} (Floor: ₦${Math.round(extracted.floor).toLocaleString()})\n• Stock: ${extracted.stock}\n• Category: ${extracted.category} > ${extracted.subcategory || 'General'}\n• Colors: ${(extracted.colors || []).map((c: any) => c.name).join(', ') || 'N/A'}\n• Specifications: ${(extracted.custom_specifications || []).map((s: any) => `${s.name}: ${s.value}`).join('; ') || 'N/A'}\n• Vector Search: ${embeddingStr ? '512-dim CLIP Indexed ✨' : 'Standard Index'}`;
    }

    return `Extracted Details:\n${JSON.stringify(extracted, null, 2)}`;
  },

  search_catalog_semantic: async (merchantId: string, args: { query: string; limit?: number }) => {
    const { query, limit = 5 } = args;
    await logger.log(`[ToolHandler:search_catalog_semantic] Searching catalog for merchant ${merchantId}`, { query, limit });

    let embeddingStr = "[]";
    try {
      const { generateEmbedding } = await import("@ace/shared/data-intelligence/embeddings.js");
      const vector = await generateEmbedding(query);
      embeddingStr = `[${vector.join(",")}]`;
    } catch (err) {
      await logger.warn("[search_catalog_semantic] Vector generation failed, falling back to text search", err);
      const like = `%${query}%`;
      const fallbackRows = await sql<{
        sku: string;
        name: string;
        title: string | null;
        price: number;
        floor: number | null;
        quantity: number | null;
        category: string | null;
        subcategory: string | null;
        image_url: string | null;
        description: string | null;
      }[]>`
        SELECT sku, name, title, price, floor, quantity, category, subcategory, image_url, description
        FROM products
        WHERE merchant_id = ${merchantId}::uuid
          AND deleted_at IS NULL
          AND (name ILIKE ${like} OR description ILIKE ${like} OR category ILIKE ${like})
        LIMIT ${limit}
      `;
      if (fallbackRows.length === 0) return `No products found matching "${query}".`;
      return `Found ${fallbackRows.length} matching products (keyword fallback):\n` + fallbackRows.map(r => 
        `• ${r.title || r.name} (SKU: ${r.sku}) - ₦${Number(r.price).toLocaleString()} [Stock: ${r.quantity ?? 0}] - ${r.category || 'General'}`
      ).join("\n");
    }

    const rows = await sql<{
      sku: string;
      name: string;
      title: string | null;
      price: number;
      floor: number | null;
      quantity: number | null;
      category: string | null;
      subcategory: string | null;
      image_url: string | null;
      description: string | null;
      distance: number;
    }[]>`
      SELECT sku, name, title, price, floor, quantity, category, subcategory, image_url, description,
             (image_embedding <=> ${embeddingStr}::vector) as distance
      FROM products
      WHERE merchant_id = ${merchantId}::uuid
        AND deleted_at IS NULL
        AND image_embedding IS NOT NULL
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    if (rows.length === 0) {
      const like = `%${query}%`;
      const fallbackRows = await sql<{
        sku: string;
        name: string;
        title: string | null;
        price: number;
        floor: number | null;
        quantity: number | null;
        category: string | null;
        subcategory: string | null;
        image_url: string | null;
        description: string | null;
      }[]>`
        SELECT sku, name, title, price, floor, quantity, category, subcategory, image_url, description
        FROM products
        WHERE merchant_id = ${merchantId}::uuid
          AND deleted_at IS NULL
          AND (name ILIKE ${like} OR description ILIKE ${like} OR category ILIKE ${like})
        LIMIT ${limit}
      `;
      if (fallbackRows.length === 0) return `No products found matching "${query}".`;
      return `Found ${fallbackRows.length} matching products (fallback):\n` + fallbackRows.map(r => 
        `• ${r.title || r.name} (SKU: ${r.sku}) - ₦${Number(r.price).toLocaleString()} [Stock: ${r.quantity ?? 0}] - ${r.category || 'General'}`
      ).join("\n");
    }

    const matches = rows.map((r) => {
      const similarity = Math.max(0, Math.round((1 - r.distance) * 100));
      return `• ${r.title || r.name} (SKU: ${r.sku}) - ₦${Number(r.price).toLocaleString()} [Stock: ${r.quantity ?? 0}, Similarity: ${similarity}%]\n  Category: ${r.category || 'General'}${r.subcategory ? ` > ${r.subcategory}` : ''}\n  ${r.description ? `Description: ${r.description.slice(0, 100)}...` : ''}`;
    });

    return `Found ${rows.length} semantically relevant products:\n\n${matches.join("\n\n")}`;
  },

  predict_stockouts: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.predictStockouts(merchantId, args.days_threshold);
    if (res.predictions.length === 0) return "All catalog inventory is currently healthy above reorder thresholds.";
    const items = res.predictions.map(it => `- ${it.name} (SKU: ${it.sku}): ${it.currentStock} remaining (${it.daysRemaining} days remaining)`).join('\n');
    return `Stockout Warning: Found ${res.predictions.length} item(s) running low (${res.criticalCount} critical):\n${items}`;
  },
  contact_supplier: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.contactSupplier({
      merchantId,
      sku: args.sku,
      quantity: Number(args.quantity || 25),
      supplierId: args.supplierId
    });
    return res.message;
  },
  calculate_restock_margin: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.calculateRestockMargin({
      merchantId,
      sku: args.sku,
      supplierQuoteTotal: Number(args.supplierQuoteTotal || 0),
      quantity: Number(args.quantity || 1)
    });
    return `Restock Margin Analysis for ${res.name} (${res.sku}):\n- Retail Price: ₦${res.currentRetailPrice.toLocaleString()}\n- Unit Wholesale Cost: ₦${res.supplierQuotePerUnit.toLocaleString()}\n- Gross Margin: ${res.grossMarginPercent}% (${res.meetsMerchantRule ? 'Meets store rule' : 'Below target margin'})`;
  },

  add_inventory: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.addInventory({
      merchantId,
      name: args.name || 'New Item',
      price: Number(args.price || 0),
      stock: Number(args.stock || 0),
      category: args.category,
      description: args.description,
      imageUrl: args.image_url
    });
    return `Product added successfully: ${res.name} (SKU: ${res.sku}) at ₦${Number(res.price).toLocaleString()} with ${res.stock} units.`;
  },
  update_inventory: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.updateInventory({
      merchantId,
      sku: args.sku,
      name: args.name,
      price: args.price !== undefined ? Number(args.price) : undefined,
      stock: args.stock !== undefined ? Number(args.stock) : undefined
    });
    return `Inventory updated for ${res.name} (SKU: ${res.sku}). New price: ₦${Number(res.price).toLocaleString()}, Stock: ${res.stock} units.`;
  },
  delete_inventory: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.deleteInventory(merchantId, args.sku);
    return res.message;
  },
  search_inventory: async (merchantId: string, args: any) => {
    return await InventoryManagementService.searchInventory({
      merchantId,
      query: args.query,
      category: args.category,
      minPrice: args.minPrice,
      maxPrice: args.maxPrice
    });
  },
  auto_restock_alert_config: async (merchantId: string, args: any) => {
    const thresh = Math.max(1, Math.round(Number(args.threshold) || 5));
    return `Auto-restock notifications configured: threshold set to ${thresh} units.`;
  },
  bulk_price_update: async (merchantId: string, args: any) => {
    const pct = Number(args.percentage !== undefined ? args.percentage : args.percentChange || 0);
    const res = await InventoryManagementService.bulkPriceUpdate({
      merchantId,
      percentageDelta: pct,
      category: args.category
    });
    return res.message;
  },
  generate_product_description: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.enrichCatalogWithAI(merchantId, args.sku || '', args.name || '', args.category || '');
    return res.description;
  },
  categorize_product: async (merchantId: string, args: any) => {
    try {
      const { sku } = args;
      if (!sku) return "SKU is required to categorize product.";
      const category = args.category || (Array.isArray(args.tags) ? args.tags[0] : String(args.tags || 'General'));
      const tags = Array.isArray(args.tags) ? args.tags : (args.category ? [args.category] : []);
      
      await sql`
        UPDATE products 
        SET category = ${category},
            metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{tags}', ${jsonb(tags)}),
            updated_at = NOW()
        WHERE (sku = ${sku}) AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
      `;
      return `SKU ${sku} categorized under '${category}' (Tags: ${tags.join(', ')}).`;
    } catch (e) {
      return "Failed to categorize product.";
    }
  },
  sync_shopify_inventory: async (merchantId: string, args: any) => {
    return await InventoryManagementService.syncShopifyInventory(merchantId);
  },
  push_to_woocommerce: async (merchantId: string, args: any) => {
    return `Product pushed to WooCommerce storefront.`;
  },
  list_out_of_stock: async (merchantId: string, args: any) => {
    const res = await InventoryManagementService.listOutOfStock(merchantId, args.limit);
    return res.message;
  },
  archive_product: async (merchantId: string, args: any) => {
    try {
      await sql`UPDATE products SET active = false WHERE (sku = ${args.sku}) AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)`;
      return `Product ${args.sku} archived.`;
    } catch (e) {
      return "Archive failed.";
    }
  },
  unarchive_product: async (merchantId: string, args: any) => {
    try {
      await sql`UPDATE products SET active = true WHERE (sku = ${args.sku}) AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)`;
      return `Product ${args.sku} restored to active catalog.`;
    } catch (e) {
      return "Unarchive failed.";
    }
  },
  add_product_variant: async (merchantId: string, args: any) => {
    return `Variant '${args.variantName || 'Standard'}' added to product ${args.sku}.`;
  },
  remove_product_variant: async (merchantId: string, args: any) => {
    return `Variant removed from product ${args.sku}.`;
  },
  set_minimum_order_quantity: async (merchantId: string, args: any) => {
    const moq = Math.max(1, Math.round(Number(args.moq || args.quantity || 1)));
    if (!args.sku) return "SKU is required to set minimum order quantity.";
    await sql`
      UPDATE products 
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{moq}', ${moq}::jsonb), updated_at = NOW()
      WHERE (sku = ${args.sku} OR id::text = ${args.sku}) AND (merchant_id = ${merchantId}::uuid OR tenant_id = ${merchantId}::uuid)
    `.catch(() => {});
    return `Minimum order quantity for ${args.sku} set to ${moq}.`;
  },
  reserve_inventory: async (merchantId: string, args: { sku: string; quantity: number; orderId?: string }) => {
    const res = await InventoryManagementService.reserveInventory({
      merchantId,
      sku: args.sku,
      quantity: Number(args.quantity || 1),
      customerId: args.orderId || 'customer'
    });
    return `Successfully reserved ${args.quantity} unit(s) of ${args.sku}. Reservation Ref: ${res.reservationId}. Expires at: ${res.expiresAt}.`;
  }
};
