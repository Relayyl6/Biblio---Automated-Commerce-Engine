import { OutboundMessage } from "@ace/shared/types";

export async function send(msg: OutboundMessage): Promise<void> {
  // TODO: Implement Telegram Bot API send
  console.log(`[Telegram Sender] Sending message to ${msg.toSenderId}:`, msg.text);
}
