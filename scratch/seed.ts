import postgres from "postgres";
import fs from "fs";
import path from "path";

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  console.log("Seeding merchant data...");

  const merchantId = '00000000-0000-0000-0000-000000000001';
  const name = 'My Shop';
  const toneGuide = 'Warm, friendly, never pushy';
  const dialect = 'pidgin';
  const phoneId = '1174371249097383';

  try {
    await sql`
      INSERT INTO merchants (id, name, phone_number_id, tone_guide, dialect)
      VALUES (${merchantId}, ${name}, ${phoneId}, ${toneGuide}, ${dialect})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone_number_id = EXCLUDED.phone_number_id,
        tone_guide = EXCLUDED.tone_guide,
        dialect = EXCLUDED.dialect;
    `;
    console.log("✅ Inserted merchant");

    await sql`
      INSERT INTO customer_merchant_links (customer_id, merchant_id)
      VALUES ('2348012345678', ${merchantId})
      ON CONFLICT DO NOTHING;
    `;
    console.log("✅ Added customer link for Simulator test customer (2348012345678)");
    
    console.log("Seeding complete!");
  } catch (err) {
    console.error("Error seeding DB:", err);
  } finally {
    process.exit(0);
  }
}

run();
