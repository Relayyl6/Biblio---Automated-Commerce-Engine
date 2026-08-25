require('dotenv').config();
const { sql } = require('./ace-whatsapp/shared/src/clients.js');
async function run() {
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
    console.log("Migration applied.");
    process.exit(0);
}
run();
