import { sql } from './shared/src/clients.js';
async function main() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS merchant_integrations (
        merchant_id UUID NOT NULL,
        provider TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (merchant_id, provider)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        merchant_id UUID NOT NULL,
        customer_id TEXT NOT NULL,
        service_id UUID NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        calendar_event_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `;
    console.log('Tables created successfully.');
  } catch (e) {
    console.error('Error applying schema:', e);
  } finally {
    process.exit(0);
  }
}
main();
