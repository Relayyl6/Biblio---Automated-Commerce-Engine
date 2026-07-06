import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Email Inbound Parse (SendGrid) payload into UnifiedMessage
  console.log("[Email Adapter] Normalising payload", payload);
  return [];
}
