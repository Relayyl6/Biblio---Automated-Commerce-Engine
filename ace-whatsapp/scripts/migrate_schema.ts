import { sql } from "@ace/shared/clients.js";

async function runMigration() {
  console.log("==> Running Biblio Augmented Schema Migration...");

  // 1. Merchants Table Alterations
  console.log("1. Updating merchants table with robust business registration & contact fields...");
  await sql`
    ALTER TABLE merchants
    ADD COLUMN IF NOT EXISTS bank_details JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS paystack_recipient_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS payout_frequency VARCHAR(32) DEFAULT 'instant',
    ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5, 2) DEFAULT 3.00,
    ADD COLUMN IF NOT EXISTS fee_padding_model VARCHAR(32) DEFAULT 'customer_padded',
    ADD COLUMN IF NOT EXISTS owner_first_name VARCHAR(128) DEFAULT 'Merchant',
    ADD COLUMN IF NOT EXISTS onboarding_state VARCHAR(32) DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS rc_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS business_type VARCHAR(64) DEFAULT 'SOLE_PROPRIETOR',
    ADD COLUMN IF NOT EXISTS tax_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS support_email VARCHAR(128),
    ADD COLUMN IF NOT EXISTS support_phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS website_url TEXT,
    ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS physical_address JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS return_policy TEXT,
    ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
    ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS supports_pickup BOOLEAN DEFAULT true
  `;

  // 2. Vendors Table Alterations
  console.log("2. Updating vendors table...");
  await sql`
    ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS owner_first_name VARCHAR(128) DEFAULT 'Merchant',
    ADD COLUMN IF NOT EXISTS onboarding_state VARCHAR(32) DEFAULT 'completed',
    ADD COLUMN IF NOT EXISTS fee_padding_model VARCHAR(32) DEFAULT 'customer_padded',
    ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5, 2) DEFAULT 3.00,
    ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS rc_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS business_type VARCHAR(64) DEFAULT 'SOLE_PROPRIETOR'
  `;

  // 3. Products Table Alterations
  console.log("3. Updating products table with augmented fields...");
  await sql`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
    ADD COLUMN IF NOT EXISTS detailed_description TEXT,
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(128),
    ADD COLUMN IF NOT EXISTS sub_sub_category VARCHAR(128),
    ADD COLUMN IF NOT EXISTS regular_price NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS total_sales INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS custom_specifications JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS custom_properties JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'Active'
  `;

  // 4. Order Disputes Table
  console.log("4. Creating order_disputes table...");
  await sql`
    CREATE TABLE IF NOT EXISTS order_disputes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL,
      merchant_id UUID NOT NULL,
      customer_id VARCHAR(64) NOT NULL,
      reason TEXT NOT NULL,
      evidence_urls JSONB DEFAULT '[]',
      refund_amount_ngn NUMERIC(12, 2) NOT NULL,
      status VARCHAR(32) DEFAULT 'pending_review',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `;

  // 5. Merchant Agent Transcripts Table (Cross-channel Parity)
  console.log("5. Creating merchant_agent_transcripts table...");
  await sql`
    CREATE TABLE IF NOT EXISTS merchant_agent_transcripts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merchant_id UUID NOT NULL,
      channel VARCHAR(32) NOT NULL,
      sender_role VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_transcripts_merchant 
    ON merchant_agent_transcripts(merchant_id, created_at DESC)
  `;

  // 6. Orders Table Pickup and Fulfillment Columns
  console.log("6. Updating orders table with fulfillment & pickup support...");
  await sql`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(20) DEFAULT 'delivery',
    ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS pickup_address TEXT
  `;

  // 7. Merchant Integrations Table
  console.log("7. Ensuring merchant_integrations table exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS merchant_integrations (
      merchant_id UUID REFERENCES merchants(id),
      provider VARCHAR(50) NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      PRIMARY KEY (merchant_id, provider)
    );
  `;

  // 8. Platform Master Credentials Table
  console.log("8. Ensuring platform_credentials table exists...");
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

  console.log("✅ Biblio Augmented Schema Migration successfully completed!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
