import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement TikTok Shop/Messaging API send
  console.log(`[TikTok Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
