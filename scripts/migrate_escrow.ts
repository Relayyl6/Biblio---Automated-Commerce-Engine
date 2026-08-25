import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";

async function main() {
  logger.log("Creating escrow_accounts table...");
  await sql`
    CREATE TABLE IF NOT EXISTS escrow_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        merchant_id UUID NOT NULL REFERENCES merchants(id),
        customer_id VARCHAR(255) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'held',
        held_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        auto_release_at TIMESTAMP WITH TIME ZONE,
        released_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_escrow_order_id ON escrow_accounts(order_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_escrow_merchant_id ON escrow_accounts(merchant_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_accounts(status);`;
  
  logger.log("Escrow table created successfully.");
  process.exit(0);
}
main().catch((err) => {
    logger.error("Migration failed:", err);
    process.exit(1);
});
