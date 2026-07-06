import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract TikTok Shop/Messaging API payload into UnifiedMessage
  console.log("[TikTok Adapter] Normalising payload", payload);
  return [];
}
