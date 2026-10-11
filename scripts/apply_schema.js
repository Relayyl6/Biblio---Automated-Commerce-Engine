import fs from 'fs';
import { sql } from './shared/src/clients.js';
async function main() {
  try {
    const schema = fs.readFileSync('infra/schema.sql', 'utf8');
    await sql.unsafe(schema);
    console.log('Schema applied successfully.');
  } catch (e) {
    console.error('Error applying schema:', e);
  } finally {
    process.exit(0);
  }
}
main();
