import { logger } from "@ace/shared/logger.js";
import AfricasTalking from "africastalking";

const AT_API_KEY = process.env.AT_API_KEY || "dummy_key";
const AT_USERNAME = process.env.AT_USERNAME || "sandbox";

// Initialize the SDK
const at = AfricasTalking({
  apiKey: AT_API_KEY,
  username: AT_USERNAME
});

const sms = at.SMS;

export async function sendEscalationSms(toPhone: string, message: string): Promise<boolean> {
  try {
    logger.log(`[AfricasTalking] Sending SMS to ${toPhone}`);
    
    if (process.env.NODE_ENV !== "production") {
      logger.log(`[AfricasTalking] Sandbox mock send: "${message}"`);
      return true; // Bypass real network cost in dev
    }

    const options = {
      to: [toPhone],
      message: message,
      // enqueue: true // Phase 3: High volume queueing
    };

    const response = await sms.send(options);
    logger.log(`[AfricasTalking] SMS dispatched. Response:`, response);
    return true;
  } catch (err) {
    logger.error(`[AfricasTalking] Failed to send SMS:`, err);
    throw err;
  }
}
