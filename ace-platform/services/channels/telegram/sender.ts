import { logger } from "@ace/shared/logger.js";
import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Telegram Bot API send
  logger.log(`[Telegram Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
