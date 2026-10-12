import { sql } from "@ace/shared/clients.js";

async function migrateSubscriptionTier() {
  console.log("==> Adding subscription_tier to merchants and vendors in Neon DB...");

  await sql`
    ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(32) DEFAULT 'starter'
  `;

  await sql`
    ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(32) DEFAULT 'starter'
  `;

  console.log("✅ subscription_tier column migration completed successfully!");
  process.exit(0);
}

migrateSubscriptionTier().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
