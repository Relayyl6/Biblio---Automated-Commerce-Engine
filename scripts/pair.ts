import { logger } from "@ace/shared/logger.js";
import { pairVendorNumber } from "./ace-whatsapp/core/baileys-gateway/src/sessionManager.js";

async function main() {
  const phone = process.argv[2] || "2349064982841";
  logger.log(`\n======================================================`);
  logger.log(`  BIBLIO AUTO-PROVISIONING & WHATSAPP PAIRING UTILITY`);
  logger.log(`======================================================`);
  logger.log(`Phone number: +${phone.replace(/^\+/, "")}`);
  logger.log(`\n1. Checking merchant & vendor in database (auto-creating if needed)...`);
  logger.log(`2. Connecting to WhatsApp pairing service...`);

  try {
    const res = await pairVendorNumber(phone);
    logger.log(`\n------------------------------------------------------`);
    logger.log(`✅ SUCCESS! Vendor ID:   ${res.vendorId}`);
    logger.log(`✅ Merchant ID:          ${res.merchantId}`);
    logger.log(`\n👉 YOUR 8-DIGIT PAIRING CODE:`);
    logger.log(`\n         ⭐  ${res.code}  ⭐\n`);
    logger.log(`------------------------------------------------------`);
    logger.log(`\nHow to link on your phone:`);
    logger.log(`1. Open WhatsApp on your phone (+${phone.replace(/^\+/, "")})`);
    logger.log(`2. Tap Menu (⋮) or Settings ⚙️ -> Linked Devices`);
    logger.log(`3. Tap "Link a Device" -> Tap "Link with phone number instead"`);
    logger.log(`4. Enter the code above: ${res.code}\n`);
    logger.log(`Once entered, your store is live!`);
    logger.log(`You can now:`);
    logger.log(`- Open "Message yourself" in WhatsApp and type: 'business 25k' or send photos with caption 'business <price>' to manage products.`);
    logger.log(`- Message your number from any other phone to chat with the AI Negotiator!`);
    logger.log(`======================================================\n`);
  } catch (err) {
    logger.error(`\n❌ Error during pairing:`, err);
    process.exit(1);
  }
}

main();
