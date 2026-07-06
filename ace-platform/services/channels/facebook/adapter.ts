import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Facebook Messenger Graph API payload into UnifiedMessage
  console.log("[Facebook Adapter] Normalising payload", payload);
  return [];
}
