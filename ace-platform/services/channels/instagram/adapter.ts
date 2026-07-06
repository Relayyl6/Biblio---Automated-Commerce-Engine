import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Instagram Graph API payload into UnifiedMessage
  console.log("[Instagram Adapter] Normalising payload", payload);
  return [];
}
