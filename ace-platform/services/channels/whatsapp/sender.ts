import { logger } from "@ace/shared/logger.js";
import { OutboundMessage } from "@ace/shared/types";
import { sendWhatsAppMessage } from "../../../../ace-whatsapp/core/comms-router/src/whatsapp";

export async function send(msg: OutboundMessage): Promise<void> {
  // We use the existing sendWhatsAppMessage from Phase 1
  // We need a dummy phoneNumberId for now unless passed in
  const phoneNumberId = "default_phone_id";
  const toPhone = msg.toSenderId ?? msg.toPhone;
  
  if (!toPhone) {
    throw new Error("WhatsApp message requires toSenderId or toPhone.");
  }
  
  await sendWhatsAppMessage({ toPhone, text: msg.text, buttons: msg.buttons }, phoneNumberId);
  logger.log(`[WhatsApp Sender] Dispatched message to ${toPhone}`);
}
