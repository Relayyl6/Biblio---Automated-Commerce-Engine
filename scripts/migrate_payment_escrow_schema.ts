import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients";

async function main() {
  logger.log("Adding missing columns to orders and escrow_accounts...");
  
  await sql`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id);
  `;
  await sql`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
  `;
  
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id);
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS held_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMP WITH TIME ZONE;
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS released_at TIMESTAMP WITH TIME ZONE;
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  `;
  await sql`
    ALTER TABLE escrow_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_escrow_order_id ON escrow_accounts(order_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_escrow_merchant_id ON escrow_accounts(merchant_id);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_accounts(status);`;

  await sql`ALTER TABLE orders ALTER COLUMN items SET DEFAULT '[]'::jsonb;`;
  await sql`ALTER TABLE orders ALTER COLUMN items DROP NOT NULL;`;
  await sql`ALTER TABLE products ALTER COLUMN supplier_id DROP NOT NULL;`;
  await sql`ALTER TABLE products ALTER COLUMN category DROP NOT NULL;`;
  await sql`ALTER TABLE products ALTER COLUMN unit DROP NOT NULL;`;
  await sql`ALTER TABLE escrow_accounts ALTER COLUMN payment_id DROP NOT NULL;`;
  await sql`ALTER TABLE escrow_accounts ALTER COLUMN payment_id SET DEFAULT gen_random_uuid();`;

  logger.log("Migration executed successfully!");
  process.exit(0);
}

main().catch(err => {
  logger.error("Migration error:", err);
  process.exit(1);
});
