import { logger } from "@ace/shared/logger.js";
import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement TikTok Shop/Messaging API send
  logger.log(`[TikTok Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
