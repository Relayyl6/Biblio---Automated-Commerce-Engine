import { sql } from '@ace/shared/clients';

async function test() {
  const col = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'merchants' AND column_name IN ('bank_details', 'bank_account_number')
  `;
  console.log('COLUMNS:', col);

  const row = await sql`
    SELECT id, bank_details, pg_typeof(bank_details) as btype, bank_account_number 
    FROM merchants 
    WHERE id = '4092fd9d-a137-49cc-8228-c64fb944a256'
  `;
  console.log('ROW:', row);
  console.log('typeof bank_details in JS:', typeof row[0]?.bank_details);
  console.log('value of bank_details:', row[0]?.bank_details);
  await sql.end();
}
test().catch(console.error);
