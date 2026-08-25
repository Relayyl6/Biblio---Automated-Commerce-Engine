import { logger } from "@ace/shared/logger.js";
import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract WhatsApp Business API payload into UnifiedMessage
  logger.log("[WhatsApp Adapter] Normalising payload", payload);
  return [];
}
