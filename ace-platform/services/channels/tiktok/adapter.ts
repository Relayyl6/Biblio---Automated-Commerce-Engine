import { logger } from "@ace/shared/logger.js";
import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract TikTok Shop/Messaging API payload into UnifiedMessage
  logger.log("[TikTok Adapter] Normalising payload", payload);
  return [];
}
