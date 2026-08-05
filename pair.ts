import { pairVendorNumber } from "./ace-whatsapp/core/baileys-gateway/src/sessionManager.js";

async function main() {
  const phone = process.argv[2] || "2349064982841";
  console.log(`\n======================================================`);
  console.log(`  BIBLIO AUTO-PROVISIONING & WHATSAPP PAIRING UTILITY`);
  console.log(`======================================================`);
  console.log(`Phone number: +${phone.replace(/^\+/, "")}`);
  console.log(`\n1. Checking merchant & vendor in database (auto-creating if needed)...`);
  console.log(`2. Connecting to WhatsApp pairing service...`);

  try {
    const res = await pairVendorNumber(phone);
    console.log(`\n------------------------------------------------------`);
    console.log(`✅ SUCCESS! Vendor ID:   ${res.vendorId}`);
    console.log(`✅ Merchant ID:          ${res.merchantId}`);
    console.log(`\n👉 YOUR 8-DIGIT PAIRING CODE:`);
    console.log(`\n         ⭐  ${res.code}  ⭐\n`);
    console.log(`------------------------------------------------------`);
    console.log(`\nHow to link on your phone:`);
    console.log(`1. Open WhatsApp on your phone (+${phone.replace(/^\+/, "")})`);
    console.log(`2. Tap Menu (⋮) or Settings ⚙️ -> Linked Devices`);
    console.log(`3. Tap "Link a Device" -> Tap "Link with phone number instead"`);
    console.log(`4. Enter the code above: ${res.code}\n`);
    console.log(`Once entered, your store is live!`);
    console.log(`You can now:`);
    console.log(`- Open "Message yourself" in WhatsApp and type: 'business 25k' or send photos with caption 'business <price>' to manage products.`);
    console.log(`- Message your number from any other phone to chat with the AI Negotiator!`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error(`\n❌ Error during pairing:`, err);
    process.exit(1);
  }
}

main();
