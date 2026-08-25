import { logger } from "@ace/shared/logger.js";
import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Facebook Messenger API send
  logger.log(`[Facebook Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
