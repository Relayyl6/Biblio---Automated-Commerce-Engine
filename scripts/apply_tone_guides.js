import { sql } from './shared/src/clients.js';
async function main() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tone_guides (
        id TEXT PRIMARY KEY,
        operator_id UUID NOT NULL,
        version INT NOT NULL,
        sections JSONB NOT NULL,
        approved_by TEXT NOT NULL,
        approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
        supersedes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT false
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_tone_guides_operator ON tone_guides (operator_id)`;
    console.log('tone_guides table created.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
