import { logger } from "@ace/shared/logger.js";
import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Instagram Graph API payload into UnifiedMessage
  logger.log("[Instagram Adapter] Normalising payload", payload);
  return [];
}
