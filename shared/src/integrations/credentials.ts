import { sql } from "../clients.js";
import { logger } from "../logger.js";

const ENV_PROVIDER_MAP: Record<string, string> = {
  kwik: "KWIK_API_KEY",
  gokada: "GOKADA_API_KEY",
  max: "MAX_API_KEY",
  sendstack: "SENDSTACK_API_KEY",
  sendbox: "SENDBOX_API_KEY",
  paystack: "PAYSTACK_SECRET_KEY",
  groq: "GROQ_API_KEY",
  twilio_sid: "TWILIO_ACCOUNT_SID",
  twilio_auth: "TWILIO_AUTH_TOKEN",
  twilio: "TWILIO_AUTH_TOKEN",
  africas_talking: "AT_API_KEY",
};

/**
 * Masks an API key for safe client display, showing only prefix and last 4 characters.
 */
export function maskApiKey(key: string | undefined | null): string {
  if (!key || typeof key !== "string" || key.trim() === "") return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••${suffix}`;
}

/**
 * Checks whether an API key input is a masked string placeholder (and therefore shouldn't overwrite an existing secret).
 */
export function isMaskedKey(val: string | undefined | null): boolean {
  if (!val || typeof val !== "string") return false;
  return val.includes("••••") || val.includes("****");
}

/**
 * Dynamically resolves an API key for a merchant.
 * Order of precedence:
 * 1. Specific integration entry in `merchant_integrations` table
 * 2. Key entry in `merchants.api_keys` JSONB column
 * 3. Platform fallback in `process.env[ENV_KEY]`
 */
export async function getMerchantApiKey(
  merchantId: string | undefined | null,
  provider: string
): Promise<string | null> {
  const normalizedProvider = provider.toLowerCase();

  if (merchantId) {
    try {
      // 1. Check merchant_integrations table
      const rows = await sql<{ access_token: string }[]>`
        SELECT access_token
        FROM merchant_integrations
        WHERE merchant_id = ${merchantId}::uuid AND provider = ${normalizedProvider}
        LIMIT 1
      `;
      if (rows.length > 0 && rows[0].access_token && rows[0].access_token.trim() !== "") {
        return rows[0].access_token.trim();
      }

      // 2. Check merchants.api_keys JSONB
      const mRows = await sql<{ api_keys: Record<string, string> }[]>`
        SELECT api_keys
        FROM merchants
        WHERE id = ${merchantId}::uuid
        LIMIT 1
      `;
      const apiKeys = mRows[0]?.api_keys;
      if (apiKeys && typeof apiKeys === "object") {
        const val = apiKeys[normalizedProvider] || apiKeys[provider];
        if (val && typeof val === "string" && val.trim() !== "") {
          return val.trim();
        }
      }
    } catch (err) {
      logger.error(`[getMerchantApiKey] Error querying merchant credentials for ${merchantId}:`, err);
    }
  }

  // 3. Fallback to process.env
  const envVar = ENV_PROVIDER_MAP[normalizedProvider] || `${normalizedProvider.toUpperCase()}_API_KEY`;
  const envVal = process.env[envVar];
  if (envVal && !envVal.includes("dummy_") && !envVal.includes("your_") && envVal.trim() !== "") {
    return envVal.trim();
  }

  return null;
}

/**
 * Returns complete integration record including metadata.
 */
export async function getMerchantIntegration(
  merchantId: string,
  provider: string
): Promise<{ token: string; metadata: Record<string, any> } | null> {
  const normalizedProvider = provider.toLowerCase();
  try {
    const rows = await sql<{ access_token: string; metadata: any }[]>`
      SELECT access_token, metadata
      FROM merchant_integrations
      WHERE merchant_id = ${merchantId}::uuid AND provider = ${normalizedProvider}
      LIMIT 1
    `;
    if (rows.length > 0) {
      return {
        token: rows[0].access_token,
        metadata: rows[0].metadata || {},
      };
    }
  } catch (err) {
    logger.error(`[getMerchantIntegration] Failed for ${merchantId}:`, err);
  }
  return null;
}
