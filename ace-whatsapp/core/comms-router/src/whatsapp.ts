// core/comms-router/src/whatsapp.ts
//
// The outbound half of comms-router: the only place that talks to the
// WhatsApp Business Cloud (Graph) API. Everything that sends a customer
// message goes through `sendWhatsAppMessage` so retries, payload shaping, and
// (later) the Service Window / message-consolidation logic live in one spot.
//
// Send is best-effort with bounded exponential backoff (3 attempts). We
// deliberately do NOT throw on final failure into the agent loop's happy
// path — a failed customer send is logged and surfaced via escalation rather
// than crashing the turn. (Hooking that escalation into the Vendor Communiqué
// engine is a Phase-2 gap.)

import type { OutboundMessage, OutboundButton } from "@ace/shared/types";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

// ─── Escalation priority (customer-facing fallback routing) ─────────────────
//
// From the README routing table — used when WhatsApp delivery fails and we
// fall back to SMS/voice. The channel integrations themselves (Twilio,
// Africa's Talking) are a Phase-2 gap; this enum + chooser is the contract.

export enum EscalationPriority {
  VoiceCall = "voice_call", // > ₦50,000
  PremiumSms = "premium_sms", // ₦20,000 – ₦50,000
  StandardSms = "standard_sms", // ₦5,000 – ₦20,000
  Wait = "wait", // < ₦5,000 — economics don't justify a paid channel
}

export function priorityForOrderValue(orderValueNgn: number): EscalationPriority {
  if (orderValueNgn > 50_000) return EscalationPriority.VoiceCall;
  if (orderValueNgn >= 20_000) return EscalationPriority.PremiumSms;
  if (orderValueNgn >= 5_000) return EscalationPriority.StandardSms;
  return EscalationPriority.Wait;
}

// ─── Payload builders ───────────────────────────────────────────────────────

function buildTextPayload(toPhone: string, text: string): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
    type: "text",
    text: { preview_url: false, body: text },
  };
}

/**
 * WhatsApp interactive "reply button" message. Caps at 3 buttons (Meta limit);
 * titles are truncated to 20 chars (also a Meta limit).
 */
export function buildInteractivePayload(
  toPhone: string,
  bodyText: string,
  buttons: OutboundButton[],
): Record<string, unknown> {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };
}

// ─── Send ───────────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  msg: OutboundMessage,
  phoneNumberId: string,
): Promise<void> {
  if (!ACCESS_TOKEN) {
    throw new Error("WHATSAPP_TOKEN is not set");
  }

  const payload =
    msg.buttons && msg.buttons.length > 0
      ? buildInteractivePayload(msg.toPhone, msg.text ?? "", msg.buttons)
      : buildTextPayload(msg.toPhone, msg.text ?? "");

  const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) return;

      // 4xx (except 429) won't fix themselves on retry — fail fast.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const body = await safeText(res);
        throw new Error(`WhatsApp send failed (${res.status}): ${body}`);
      }
      lastError = new Error(`WhatsApp send transient error (${res.status})`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(BASE_BACKOFF_MS * 2 ** attempt);
    }
  }

  console.error("[whatsapp] send failed after retries:", lastError);
  throw lastError instanceof Error ? lastError : new Error("WhatsApp send failed");
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<unreadable body>";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
