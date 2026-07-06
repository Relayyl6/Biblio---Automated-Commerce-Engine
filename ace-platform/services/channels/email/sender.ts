import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Email (SendGrid/SMTP) API send
  console.log(`[Email Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
