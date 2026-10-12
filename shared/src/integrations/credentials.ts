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

// In-memory cache for platform default credentials to avoid redundant DB roundtrips (60s TTL)
interface CachedPlatformKey {
  key: string | null;
  expiresAt: number;
}
const platformKeyCache = new Map<string, CachedPlatformKey>();
const CACHE_TTL_MS = 60 * 1000;

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
 * Resolves the platform master default key for a given provider.
 * Checks DB table `platform_credentials` first, then falls back to `process.env`.
 */
export async function getPlatformDefaultKey(provider: string): Promise<string | null> {
  const normalizedProvider = provider.toLowerCase();
  const now = Date.now();

  const cached = platformKeyCache.get(normalizedProvider);
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  try {
    const rows = await sql<{ api_key: string; is_active: boolean }[]>`
      SELECT api_key, is_active
      FROM platform_credentials
      WHERE provider = ${normalizedProvider}
      LIMIT 1
    `;
    if (rows.length > 0 && rows[0].is_active && rows[0].api_key && rows[0].api_key.trim() !== "") {
      const dbKey = rows[0].api_key.trim();
      platformKeyCache.set(normalizedProvider, { key: dbKey, expiresAt: now + CACHE_TTL_MS });
      return dbKey;
    }
  } catch (err) {
    // If table doesn't exist yet or query fails, quietly fall back to env
    logger.debug(`[getPlatformDefaultKey] DB lookup skipped for ${normalizedProvider}:`, err);
  }

  // Fallback to process.env
  const envVar = ENV_PROVIDER_MAP[normalizedProvider] || `${normalizedProvider.toUpperCase()}_API_KEY`;
  const envVal = process.env[envVar];
  if (envVal && !envVal.includes("dummy_") && !envVal.includes("your_") && envVal.trim() !== "") {
    const clean = envVal.trim();
    platformKeyCache.set(normalizedProvider, { key: clean, expiresAt: now + CACHE_TTL_MS });
    return clean;
  }

  platformKeyCache.set(normalizedProvider, { key: null, expiresAt: now + CACHE_TTL_MS });
  return null;
}

/**
 * Checks whether a platform default credential exists and is active for the given provider.
 */
export async function isPlatformDefaultAvailable(provider: string): Promise<boolean> {
  const key = await getPlatformDefaultKey(provider);
  return Boolean(key && key.trim() !== "");
}

/**
 * Dynamically resolves an API key for a merchant.
 * Order of precedence:
 * 1. Specific integration entry in `merchant_integrations` table (BYOK)
 * 2. Key entry in `merchants.api_keys` JSONB column (App Settings)
 * 3. Platform Master Default Pool (`platform_credentials` table -> `process.env[ENV_KEY]`)
 */
export async function getMerchantApiKey(
  merchantId: string | undefined | null,
  provider: string
): Promise<string | null> {
  const normalizedProvider = provider.toLowerCase();

  if (merchantId) {
    try {
      // 1. Check merchant_integrations table (Custom BYOK)
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

  // 3. Fallback to Platform Master Default Pool
  return await getPlatformDefaultKey(normalizedProvider);
}

/**
 * Resolves credential status and source for a merchant.
 */
export async function getMerchantCredentialStatus(
  merchantId: string | undefined | null,
  provider: string
): Promise<{
  source: "custom_override" | "managed_pool" | "unconfigured";
  maskedKey: string;
  isPlatformDefaultActive: boolean;
}> {
  const normalizedProvider = provider.toLowerCase();
  let customKey: string | null = null;

  if (merchantId) {
    try {
      const rows = await sql<{ access_token: string }[]>`
        SELECT access_token
        FROM merchant_integrations
        WHERE merchant_id = ${merchantId}::uuid AND provider = ${normalizedProvider}
        LIMIT 1
      `;
      if (rows[0]?.access_token?.trim()) {
        customKey = rows[0].access_token.trim();
      } else {
        const mRows = await sql<{ api_keys: Record<string, string> }[]>`
          SELECT api_keys FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1
        `;
        const val = mRows[0]?.api_keys?.[normalizedProvider] || mRows[0]?.api_keys?.[provider];
        if (typeof val === "string" && val.trim() !== "") {
          customKey = val.trim();
        }
      }
    } catch (err) {
      logger.error(`[getMerchantCredentialStatus] Query failed:`, err);
    }
  }

  const platformKey = await getPlatformDefaultKey(normalizedProvider);
  const isPlatformDefaultActive = Boolean(platformKey);

  if (customKey) {
    return {
      source: "custom_override",
      maskedKey: maskApiKey(customKey),
      isPlatformDefaultActive,
    };
  }

  if (isPlatformDefaultActive) {
    return {
      source: "managed_pool",
      maskedKey: maskApiKey(platformKey),
      isPlatformDefaultActive: true,
    };
  }

  return {
    source: "unconfigured",
    maskedKey: "",
    isPlatformDefaultActive: false,
  };
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

/**
 * Updates or registers a platform master default credential.
 */
export async function upsertPlatformCredential(
  provider: string,
  apiKey: string,
  secretKey?: string,
  description?: string
): Promise<void> {
  const normalizedProvider = provider.toLowerCase();
  await sql`
    INSERT INTO platform_credentials (provider, api_key, secret_key, description, is_active, updated_at)
    VALUES (${normalizedProvider}, ${apiKey.trim()}, ${secretKey?.trim() || null}, ${description || null}, true, NOW())
    ON CONFLICT (provider) DO UPDATE SET
      api_key = EXCLUDED.api_key,
      secret_key = COALESCE(EXCLUDED.secret_key, platform_credentials.secret_key),
      description = COALESCE(EXCLUDED.description, platform_credentials.description),
      is_active = true,
      updated_at = NOW()
  `;
  platformKeyCache.delete(normalizedProvider);
}
