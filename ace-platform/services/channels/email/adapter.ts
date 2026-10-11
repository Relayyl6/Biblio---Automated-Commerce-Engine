import { logger } from "@ace/shared/logger.js";
import { UnifiedMessage } from "@ace/shared/types";

export async function normalize(payload: any): Promise<UnifiedMessage[]> {
  // TODO: Extract Email Inbound Parse (SendGrid) payload into UnifiedMessage
  logger.log("[Email Adapter] Normalising payload", payload);
  return [];
}
