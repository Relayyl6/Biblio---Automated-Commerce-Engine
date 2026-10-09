import { config } from "dotenv";
config();
import { sql } from "@ace/shared/clients";

async function checkPhone() {
  const merchantId = "11111111-1111-1111-1111-111111111111"; // Amaka Fashion House
  
  // Create vendor if not exists
  await sql`
    INSERT INTO vendors (merchant_id, personal_number) 
    VALUES (${merchantId}, '2348000000000') 
    ON CONFLICT DO NOTHING
  `;
  
  const vendors = await sql`SELECT personal_number FROM vendors WHERE merchant_id = ${merchantId}`;
  console.log("Vendors:", vendors);
  process.exit(0);
}
checkPhone();
