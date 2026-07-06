import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract WhatsApp Business API payload into UnifiedMessage
  console.log("[WhatsApp Adapter] Normalising payload", payload);
  return [];
}
