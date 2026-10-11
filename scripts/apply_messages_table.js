import { sql } from './shared/src/clients.js';
async function main() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL,
        customer_id TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_conv_msgs_merchant_customer ON conversation_messages (merchant_id, customer_id)
    `;
    console.log('conversation_messages table created successfully.');
  } catch (e) {
    console.error('Error applying schema:', e);
  } finally {
    process.exit(0);
  }
}
main();
