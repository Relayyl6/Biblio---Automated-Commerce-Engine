import { sql } from '@ace/shared/clients';
import fs from 'fs';

async function migrate() {
  try {
    const schemaSql = fs.readFileSync('infra/schema.sql', 'utf8');
    await sql.unsafe(schemaSql);
    console.log('Migration successful');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}
migrate();
