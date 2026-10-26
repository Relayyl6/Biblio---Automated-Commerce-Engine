const postgres = require('../node_modules/postgres');
require('dotenv').config();
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 2 });

async function main() {
  // Create app_config table for platform-wide settings (e.g. FX rate)
  await sql`
    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('app_config table created/confirmed');

  // Seed with current USD/NGN rate (admin can update this via dashboard)
  await sql`
    INSERT INTO app_config (key, value)
    VALUES ('usd_ngn_rate', '1650')
    ON CONFLICT (key) DO NOTHING
  `;
  console.log('usd_ngn_rate seeded');

  await sql.end();
  console.log('Done.');
}
main().catch(e => { console.error(e.message); process.exit(1); });
