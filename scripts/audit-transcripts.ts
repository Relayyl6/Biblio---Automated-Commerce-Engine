import { sql } from "@ace/shared/clients";

async function run() {
  const transcripts = await sql`
    SELECT id, merchant_id, channel, sender_role, content, metadata, created_at 
    FROM merchant_agent_transcripts 
    ORDER BY created_at DESC 
    LIMIT 15
  `;
  console.log('--- RECENT TRANSCRIPTS (Total:', transcripts.length, ') ---');
  for (const t of transcripts) {
    console.log(`[${t.created_at}] [${t.channel}] ${t.sender_role} (merchant: ${t.merchant_id}):\n${t.content}\n`);
  }

  const merchants = await sql`
    SELECT id, name, owner_first_name, bank_details, bank_account_number, phone_number_id, contact_phone 
    FROM merchants
  `;
  console.log('--- MERCHANTS ---');
  console.log(JSON.stringify(merchants, null, 2));

  await sql.end();
}
run().catch(console.error);
