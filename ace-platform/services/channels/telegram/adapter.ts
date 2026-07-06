import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Telegram Bot API payload into UnifiedMessage
  console.log("[Telegram Adapter] Normalising payload", payload);
  return [];
}
