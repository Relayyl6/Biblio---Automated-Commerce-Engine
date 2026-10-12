import { sql } from "@ace/shared/clients.js";

const DEFAULT_SEEDS: Record<string, string | undefined> = {
  kwik: process.env.KWIK_API_KEY,
  gokada: process.env.GOKADA_API_KEY,
  max: process.env.MAX_API_KEY,
  sendstack: process.env.SENDSTACK_API_KEY,
  sendbox: process.env.SENDBOX_API_KEY,
  paystack: process.env.PAYSTACK_SECRET_KEY,
  groq: process.env.GROQ_API_KEY,
  africas_talking: process.env.AT_API_KEY,
  twilio: process.env.TWILIO_AUTH_TOKEN,
  twilio_sid: process.env.TWILIO_ACCOUNT_SID,
};

async function migratePlatformCredentials() {
  console.log("==> Creating platform_credentials table in Neon DB...");

  await sql`
    CREATE TABLE IF NOT EXISTS platform_credentials (
      provider VARCHAR(50) PRIMARY KEY,
      api_key TEXT NOT NULL,
      secret_key TEXT,
      environment VARCHAR(20) DEFAULT 'production',
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log("==> Seeding platform master defaults from environment if present...");

  for (const [provider, rawKey] of Object.entries(DEFAULT_SEEDS)) {
    if (rawKey && !rawKey.includes("dummy_") && !rawKey.includes("your_") && rawKey.trim() !== "") {
      const cleanKey = rawKey.trim();
      await sql`
        INSERT INTO platform_credentials (provider, api_key, description, is_active, updated_at)
        VALUES (
          ${provider}, 
          ${cleanKey}, 
          ${`Platform master default for ${provider}`}, 
          true, 
          NOW()
        )
        ON CONFLICT (provider) DO UPDATE 
        SET api_key = EXCLUDED.api_key,
            updated_at = NOW()
      `;
      console.log(`  ✓ Seeded platform default for: ${provider}`);
    }
  }

  console.log("✅ Platform credentials migration completed successfully!");
  process.exit(0);
}

migratePlatformCredentials().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
