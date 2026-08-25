import { sql } from '@ace/shared/clients';
async function fix() {
  await sql`DROP TABLE IF EXISTS system_actions`;
  await sql`
  CREATE TABLE system_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id uuid NOT NULL REFERENCES merchants(id),
    action_id text NOT NULL,
    action_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz DEFAULT NOW()
  );
  `;
  console.log('Fixed system_actions');
  process.exit(0);
}
fix();
