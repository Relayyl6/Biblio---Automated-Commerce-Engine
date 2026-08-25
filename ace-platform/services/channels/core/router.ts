import { logger } from "@ace/shared/logger.js";
import { PlatformChannel, UnifiedMessage } from "@ace/shared/types";

/**
 * The Omni-Channel Ingestion Router.
 * This is the central chokepoint where raw webhooks from Instagram, TikTok, Telegram, etc.
 * are normalized into a UnifiedMessage and handed off to Identity Resolution.
 */

export interface RawWebhookPayload {
  channel: PlatformChannel;
  headers: Record<string, string>;
  body: any;
}

export async function ingestWebhook(payload: RawWebhookPayload): Promise<UnifiedMessage[]> {
  const normalizedMessages = await normalizePayload(payload);
  
  for (const msg of normalizedMessages) {
    await dispatchToIdentityResolution(msg);
  }
  
  return normalizedMessages;
}

/**
 * Delegate to channel-specific adapters to normalize their raw JSON into UnifiedMessage.
 */
async function normalizePayload(payload: RawWebhookPayload): Promise<UnifiedMessage[]> {
  switch (payload.channel) {
    case "whatsapp":
      return (await import("../whatsapp/adapter")).normalize(payload.body);
    case "instagram":
      return (await import("../instagram/adapter")).normalize(payload.body);
    case "facebook":
      return (await import("../facebook/adapter")).normalize(payload.body);
    case "telegram":
      return (await import("../telegram/adapter")).normalize(payload.body);
    case "tiktok":
      return (await import("../tiktok/adapter")).normalize(payload.body);
    case "email":
      return (await import("../email/adapter")).normalize(payload.body);
    default:
      throw new Error(`Unsupported channel: ${payload.channel}`);
  }
}

import { resolveGlobalBuyerId } from "../../../../ace-whatsapp/core/identity-resolution/src";
import { delegateToStateEngine } from "./orchestrator";

/**
 * Forward to Identity Resolution before eventually enqueueing to the Autonomous State Engine.
 */
async function dispatchToIdentityResolution(msg: UnifiedMessage): Promise<void> {
  const identity = await resolveGlobalBuyerId(msg.channel, msg.senderId);
  
  logger.log(`[Router] Normalised message from ${msg.channel} (Sender: ${msg.senderId})`);
  logger.log(`[Router] Resolved to Global Buyer ID: ${identity.globalBuyerId}`);
  
  // Hand off to Phase 4: Intent Parsing & Autonomous State Engine Routing
  await dispatchToAutonomousStateEngine(msg, identity.globalBuyerId);
}

async function dispatchToAutonomousStateEngine(msg: UnifiedMessage, globalBuyerId: string): Promise<void> {
  await delegateToStateEngine(msg, globalBuyerId);
}
