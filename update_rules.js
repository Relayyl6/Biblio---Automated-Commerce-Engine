import { sql } from './shared/src/clients.js';
async function main() {
  try {
    await sql`
      ALTER TABLE merchant_pricing_rules
      ADD COLUMN IF NOT EXISTS winback_discounts_enabled BOOLEAN DEFAULT FALSE
    `;
    console.log('Added winback_discounts_enabled column.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
