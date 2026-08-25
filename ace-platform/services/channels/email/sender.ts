import { logger } from "@ace/shared/logger.js";
import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Email (SendGrid/SMTP) API send
  logger.log(`[Email Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
