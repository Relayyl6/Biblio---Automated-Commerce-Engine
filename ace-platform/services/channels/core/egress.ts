import { PlatformChannel, OutboundMessage } from "@ace/shared/types";

/**
 * The Omni-Channel Egress Router.
 * This intercepts outgoing messages from the Autonomous State Engine 
 * and maps them back to the correct API schema (WhatsApp, TikTok, Telegram, etc.)
 */

export async function dispatchEgressMessage(msg: OutboundMessage): Promise<void> {
  const targetChannel = msg.channel ?? "whatsapp"; // Fallback to WhatsApp for legacy Phase 1
  const recipient = msg.toSenderId ?? msg.toPhone;

  if (!recipient) {
    throw new Error("OutboundMessage missing recipient (toSenderId or toPhone).");
  }

  console.log(`[Egress] Dispatching message to ${recipient} via ${targetChannel}`);

  switch (targetChannel) {
    case "whatsapp":
      // Fallback to Phase 1 sender logic
      await (await import("../whatsapp/sender")).send(msg);
      break;
    case "instagram":
      await (await import("../instagram/sender")).send(msg);
      break;
    case "facebook":
      await (await import("../facebook/sender")).send(msg);
      break;
    case "telegram":
      await (await import("../telegram/sender")).send(msg);
      break;
    case "tiktok":
      await (await import("../tiktok/sender")).send(msg);
      break;
    case "email":
      await (await import("../email/sender")).send(msg);
      break;
    default:
      throw new Error(`Unsupported egress channel: ${targetChannel}`);
  }
}
