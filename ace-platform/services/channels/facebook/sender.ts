import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Facebook Messenger API send
  console.log(`[Facebook Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
