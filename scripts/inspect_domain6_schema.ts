import { sql } from '../shared/src/clients.js';

async function main() {
  const disputesCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_disputes'`;
  console.log('order_disputes:', disputesCols.map(c => `${c.column_name}:${c.data_type}`).join(', '));

  const quarantineCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quarantine_chats'`;
  console.log('quarantine_chats:', quarantineCols.map(c => `${c.column_name}:${c.data_type}`).join(', '));

  const vendorPresenceCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendor_presence'`;
  console.log('vendor_presence:', vendorPresenceCols.map(c => `${c.column_name}:${c.data_type}`).join(', '));

  const queueCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'status_post_queue'`;
  console.log('status_post_queue:', queueCols.map(c => `${c.column_name}:${c.data_type}`).join(', '));

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
