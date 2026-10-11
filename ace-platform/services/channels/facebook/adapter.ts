import { logger } from "@ace/shared/logger.js";
import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Facebook Messenger Graph API payload into UnifiedMessage
  logger.log("[Facebook Adapter] Normalising payload", payload);
  return [];
}
