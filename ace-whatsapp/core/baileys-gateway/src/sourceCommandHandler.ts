import { logger } from "@ace/shared/logger.js";
// core/baileys-gateway/src/sourceCommandHandler.ts
//
// Handles merchant "Add source:" commands sent via the existing
// business-mode self-messaging channel (message yourself → business mode).
//
// Recognised commands:
//   "add source: Edwin, +2348012345678, sells iPhones and Samsung phones"
//   "add source: Alaba Group, group:120363XXXXXX@g.us, sells all phones"
//   "list sources"
//   "remove source: Edwin"
//   "source pricing: Edwin, >500000 → +30000, rest → +22500"

import type { WASocket } from "@whiskeysockets/baileys";
import { sql, jsonb } from "@ace/shared/clients";
import type { PricingExpression, Source } from "@ace/shared/types";
import { formatNaira } from "@ace/shared/pricingEngine";
import Groq from "groq-sdk";

// ─── Command detection ────────────────────────────────────────────────────────

const ADD_SOURCE_RE    = /^add\s+source\s*:\s*/i;
const REMOVE_SOURCE_RE = /^remove\s+source\s*:\s*/i;
const LIST_SOURCES_RE  = /^list\s+sources?$/i;
const SOURCE_PRICING_RE = /^source\s+pricing\s*:\s*/i;

export function isSourceCommand(text: string): boolean {
  if (
    ADD_SOURCE_RE.test(text) ||
    REMOVE_SOURCE_RE.test(text) ||
    LIST_SOURCES_RE.test(text) ||
    SOURCE_PRICING_RE.test(text)
  ) {
    return true;
  }
  
  // Natural language triggers
  const lower = text.toLowerCase();
  return lower.includes("supplier") || lower.includes("source") || lower.includes("vendor");
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

export async function handleSourceCommand(
  text: string,
  merchantId: string,
  selfJid: string,
  sock: WASocket
): Promise<void> {
  if (LIST_SOURCES_RE.test(text) || text.toLowerCase() === "list suppliers") {
    await handleListSources(merchantId, selfJid, sock);
    return;
  } 
  
  if (ADD_SOURCE_RE.test(text)) {
    const body = text.replace(ADD_SOURCE_RE, "").trim();
    await handleAddSource(body, merchantId, selfJid, sock);
    return;
  } 
  
  if (REMOVE_SOURCE_RE.test(text)) {
    const body = text.replace(REMOVE_SOURCE_RE, "").trim();
    await handleRemoveSource(body, merchantId, selfJid, sock);
    return;
  } 
  
  if (SOURCE_PRICING_RE.test(text)) {
    const body = text.replace(SOURCE_PRICING_RE, "").trim();
    await handleSetPricing(body, merchantId, selfJid, sock);
    return;
  }

  // Fallback to NLP parsing
  await handleNLPSourceCommand(text, merchantId, selfJid, sock);
}

async function handleNLPSourceCommand(
  text: string,
  merchantId: string,
  selfJid: string,
  sock: WASocket
): Promise<void> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
  
  const prompt = `You are an AI assistant managing suppliers/vendors for a merchant.
The merchant sent this message: "${text}"

Determine what they want to do.
Output ONLY valid JSON matching this exact structure:
{
  "action": "add" | "remove" | "list" | "pricing" | "unknown",
  "name": "Supplier Name if applicable",
  "contact": "Phone number or ID if adding (e.g. 08037438...)",
  "description": "What they sell, if provided",
  "pricing_rules": "Pricing rules if they provided any (e.g. '>500000 -> +30000')"
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    
    if (parsed.action === "add") {
      const body = `${parsed.name || "Unknown"}, ${parsed.contact || "self"}, ${parsed.description || ""}`;
      await handleAddSource(body, merchantId, selfJid, sock);
    } else if (parsed.action === "remove") {
      await handleRemoveSource(parsed.name || "", merchantId, selfJid, sock);
    } else if (parsed.action === "list") {
      await handleListSources(merchantId, selfJid, sock);
    } else if (parsed.action === "pricing") {
      const body = `${parsed.name || ""}, ${parsed.pricing_rules || ""}`;
      await handleSetPricing(body, merchantId, selfJid, sock);
    } else {
      await sock.sendMessage(selfJid, { text: "❌ I didn't quite understand that supplier command. Please be a bit more specific (e.g., 'Add Edwin as my supplier, his number is...') or use the manual 'add source: ...' format." });
    }
  } catch (err) {
    logger.error("[NLP] Source parsing error:", err);
    await sock.sendMessage(selfJid, { text: "❌ Failed to understand supplier command. Try the manual 'add source: Name, Phone, Description' format." });
  }
}

// ─── Add source ───────────────────────────────────────────────────────────────
// Format: "Edwin, +2348012345678, sells iPhones and Samsung phones"
//         "Alaba Group, group:120363XXXXXX@g.us, sells all phones"
//         "Unity"  (minimal — can add details later)

async function handleAddSource(
  body: string,
  merchantId: string,
  selfJid: string,
  sock: WASocket
): Promise<void> {
  const parts = body.split(",").map(p => p.trim());
  const name = parts[0];
  if (!name) {
    await sock.sendMessage(selfJid, { text: "❌ Format: *add source: Name, +phone, description*\n\nExample:\nadd source: Edwin, +2348012345678, sells iPhones and Samsung phones" });
    return;
  }

  const contactRaw = parts[1] ?? null;
  const description = parts.slice(2).join(",").trim() || null;

  // Determine type and normalise contact
  let type: Source["type"] = "whatsapp_individual";
  let contact: string | null = null;

  if (contactRaw) {
    if (contactRaw.toLowerCase().startsWith("group:")) {
      type = "whatsapp_group";
      contact = contactRaw.replace(/^group:/i, "").trim();
    } else if (contactRaw.startsWith("http")) {
      type = "warehouse_api";
      contact = contactRaw.trim();
    } else if (contactRaw.toLowerCase() === "self") {
      type = "self";
      contact = null;
    } else {
      // Phone number — strip + and spaces
      contact = contactRaw.replace(/^\+/, "").replace(/[\s\-()]/g, "");
    }
  }

  // Check if this merchant already has any default; make first source default
  const existing = await sql<Source[]>`
    SELECT id FROM sources WHERE merchant_id = ${merchantId} AND active = true LIMIT 1
  `;
  const isDefault = existing.length === 0;

  await sql`
    INSERT INTO sources (merchant_id, name, type, contact, description, is_default)
    VALUES (${merchantId}, ${name}, ${type}, ${contact}, ${description}, ${isDefault})
    ON CONFLICT DO NOTHING
  `;

  const typeLabel = type === "whatsapp_individual" ? "WhatsApp contact"
    : type === "whatsapp_group" ? "WhatsApp group"
    : type === "warehouse_api" ? "Warehouse API"
    : "yourself (fallback)";

  await sock.sendMessage(selfJid, {
    text: `✅ *Source added: ${name}*\n\nType: ${typeLabel}${contact ? `\nContact: ${contact}` : ""}${description ? `\nHandles: ${description}` : ""}${isDefault ? "\n\n⭐ Set as your default source (first source auto-becomes default)." : ""}\n\nTo set pricing rules, send:\n*source pricing: ${name}, >500000 → +30000, rest → +22500*`
  });
}

// ─── Remove source ────────────────────────────────────────────────────────────
// Format: "Edwin"

async function handleRemoveSource(
  name: string,
  merchantId: string,
  selfJid: string,
  sock: WASocket
): Promise<void> {
  const result = await sql`
    UPDATE sources SET active = false
    WHERE merchant_id = ${merchantId} AND LOWER(name) = LOWER(${name})
    RETURNING id
  `;

  if (result.length === 0) {
    await sock.sendMessage(selfJid, { text: `❌ No source named *${name}* found. Send *list sources* to see your sources.` });
  } else {
    await sock.sendMessage(selfJid, { text: `🗑️ Source *${name}* has been removed. Biblio will no longer contact them for prices.` });
  }
}

// ─── List sources ─────────────────────────────────────────────────────────────

async function handleListSources(
  merchantId: string,
  selfJid: string,
  sock: WASocket
): Promise<void> {
  const sources = await sql<Source[]>`
    SELECT * FROM sources WHERE merchant_id = ${merchantId} AND active = true ORDER BY created_at ASC
  `;

  if (sources.length === 0) {
    await sock.sendMessage(selfJid, {
      text: "You have no sources configured yet.\n\nTo add one:\n*add source: Edwin, +2348012345678, sells iPhones and Samsung phones*"
    });
    return;
  }

  const lines = sources.map((s, i) => {
    const rules = s.pricing_rules as PricingExpression[];
    const pricingLabel = rules.length === 0 ? "No pricing rules" : `${rules.length} rule(s)`;
    return `${i + 1}. *${s.name}* (${s.type})${s.is_default ? " ⭐" : ""}\n   📞 ${s.contact ?? "n/a"}\n   📝 ${s.description ?? "No description"}\n   💰 ${pricingLabel}`;
  });

  await sock.sendMessage(selfJid, {
    text: `📋 *Your Sources (${sources.length})*\n\n${lines.join("\n\n")}\n\n⭐ = default (used when no match found)`
  });
}

// ─── Set pricing rules ────────────────────────────────────────────────────────
// Format: "Edwin, >500000 → +30000, rest → +22500"
//         "Unity, all → +20%"
//         "Edwin, all → ask me"

async function handleSetPricing(
  body: string,
  merchantId: string,
  selfJid: string,
  sock: WASocket
): Promise<void> {
  const firstComma = body.indexOf(",");
  if (firstComma === -1) {
    await sock.sendMessage(selfJid, { text: "❌ Format:\n*source pricing: [Name], [rules]*\n\nExamples:\nsource pricing: Edwin, >500000 → +30000, rest → +22500\nsource pricing: Unity, all → +20%\nsource pricing: Edwin, all → ask me" });
    return;
  }

  const sourceName = body.slice(0, firstComma).trim();
  const rulesStr = body.slice(firstComma + 1).trim();

  const source = await sql<Source[]>`
    SELECT * FROM sources WHERE merchant_id = ${merchantId} AND LOWER(name) = LOWER(${sourceName}) AND active = true LIMIT 1
  `;

  if (source.length === 0) {
    await sock.sendMessage(selfJid, { text: `❌ No source named *${sourceName}* found. Send *list sources* to see your sources.` });
    return;
  }

  const rules = parsePricingRules(rulesStr);
  if (!rules) {
    await sock.sendMessage(selfJid, {
      text: `❌ Couldn't parse pricing rules. Use this format:\n\n*>500000 → +30000, rest → +22500*\n(for values over 500k: add 30k profit. Everything else: add 22.5k)\n\nOr:\n*all → +20%* (20% markup on everything)\n*all → ask me* (Biblio asks you each time)`
    });
    return;
  }

  await sql`
    UPDATE sources SET pricing_rules = ${jsonb(rules)}, updated_at = NOW()
    WHERE merchant_id = ${merchantId} AND LOWER(name) = LOWER(${sourceName}) AND active = true
  `;

  const preview = rules.map(r => {
    const threshold = r.if_cost_gte === 0 ? "Everything" : `Cost ≥ ${formatNaira(r.if_cost_gte)}`;
    const action = r.markup_type === "flat" ? `+${formatNaira((r as { markup: number }).markup)} profit`
      : r.markup_type === "percent" ? `+${(r as { markup: number }).markup}% profit`
      : "→ ask you for the price";
    return `• ${threshold}: ${action}`;
  }).join("\n");

  await sock.sendMessage(selfJid, {
    text: `✅ *Pricing rules set for ${sourceName}:*\n\n${preview}\n\nBiblio will apply these automatically when ${sourceName} replies with a price.`
  });
}

// ─── Pricing rule parser ──────────────────────────────────────────────────────
// Parses: ">500000 → +30000, rest → +22500"
// Parses: "all → +20%"
// Parses: "all → ask me"
// Returns null if unparseable.

function parsePricingRules(input: string): PricingExpression[] | null {
  const rules: PricingExpression[] = [];

  // Split by comma but not within the rule itself
  const segments = input.split(/,(?=\s*(?:>|\d|rest|all))/i);

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    // ">500000 → +30000" or "rest → +22500" or "all → +20%" or "all → ask me"
    const match = s.match(/^(?:>(\d[\d,]*)|rest|all)\s*[→\->\s]+\+?(\d[\d,]*)(%)?$|^(?:>(\d[\d,]*)|rest|all)\s*[→\->\s]+ask\s+me$/i);

    if (!match) return null;

    const threshold = match[1] ?? match[4] ?? "0";
    const thresholdNum = parseInt(threshold.replace(/,/g, ""), 10) || 0;
    const isAskMe = /ask\s+me/i.test(s);
    const isPercent = !!match[3];
    const markupRaw = match[2]?.replace(/,/g, "") ?? "0";
    const markupNum = parseInt(markupRaw, 10) || 0;

    if (isAskMe) {
      rules.push({ if_cost_gte: thresholdNum, markup_type: "ask_merchant" });
    } else if (isPercent) {
      rules.push({ if_cost_gte: thresholdNum, markup_type: "percent", markup: markupNum });
    } else {
      rules.push({ if_cost_gte: thresholdNum, markup_type: "flat", markup: markupNum });
    }
  }

  if (rules.length === 0) return null;

  // Sort highest threshold first so rules are evaluated correctly
  rules.sort((a, b) => b.if_cost_gte - a.if_cost_gte);

  return rules;
}
