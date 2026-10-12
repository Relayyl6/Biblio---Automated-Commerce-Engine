import { logger } from "@ace/shared/logger.js";
import { getMerchantApiKey } from "@ace/shared/integrations/credentials.js";
import AfricasTalking from "africastalking";

export async function sendEscalationSms(toPhone: string, message: string, merchantId?: string): Promise<boolean> {
  try {
    logger.log(`[AfricasTalking] Preparing SMS to ${toPhone} for merchant ${merchantId || "default"}`);

    const apiKey = await getMerchantApiKey(merchantId, "africas_talking");
    const username = process.env.AT_USERNAME || "sandbox";

    if (!apiKey || apiKey === "dummy_key") {
      if (process.env.NODE_ENV === "production") {
        logger.warn(`[AfricasTalking] No active Africa's Talking API key found for merchant ${merchantId}; skipping SMS`);
        return false;
      }
      logger.log(`[AfricasTalking] Sandbox mock send: "${message}"`);
      return true;
    }

    const atClient = AfricasTalking({
      apiKey,
      username,
    });

    const options = {
      to: [toPhone],
      message,
    };

    const response = await atClient.SMS.send(options);
    logger.log(`[AfricasTalking] SMS successfully dispatched. Response:`, response);
    return true;
  } catch (err) {
    logger.error(`[AfricasTalking] Failed to send SMS:`, err);
    throw err;
  }
}
