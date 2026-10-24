const fs = require('fs');
const postgres = require('postgres');

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/DATABASE_URL=(.+)/);
if (!match) {
  console.error('No DATABASE_URL in .env');
  process.exit(1);
}
let url = match[1].trim();
if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
  url = url.slice(1, -1);
}

const sql = postgres(url, { ssl: 'require' });

async function main() {
  console.log('Connecting to database...');
  await sql.unsafe(`
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS owner_first_name text;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS owner_last_name text;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS dob_month text;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS dob_day integer;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS dob_year integer;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS date_of_birth date;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS age_verified boolean DEFAULT true;
    ALTER TABLE merchants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
  `);
  console.log('Successfully added columns!');

  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'merchants' 
    ORDER BY ordinal_position;
  `;
  console.log('Merchants columns:', cols.map(c => c.column_name).join(', '));
  await sql.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
