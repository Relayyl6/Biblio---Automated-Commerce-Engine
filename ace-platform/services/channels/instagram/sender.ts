import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Instagram Graph API send
  console.log(`[Instagram Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
