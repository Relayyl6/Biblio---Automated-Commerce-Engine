import { sql } from "@ace/shared/clients";

async function simulate() {
  const merchantId = "11111111-1111-1111-1111-111111111111"; // Use a mock UUID
  const myPhone = "2348000000000";

  console.log("1. Insert merchant");
  await sql`
    INSERT INTO merchants (id, name, contact_phone, phone_number_id, tone_guide)
    VALUES (${merchantId}, 'Test Merchant', ${myPhone}, ${merchantId}, 'Friendly')
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("1. Done");

  console.log("2. Clear quotes");
  await sql`DELETE FROM source_quotes WHERE merchant_id = ${merchantId}`;
  console.log("2. Done");

  console.log("3. Clear sources");
  await sql`DELETE FROM sources WHERE merchant_id = ${merchantId}`;
  console.log("3. Done");

  console.log("Done successfully");
  process.exit(0);
}

simulate().catch(err => {
  console.error("Error", err);
  process.exit(1);
});
