import { procurementService } from '../../../supplier-integration/src/procurementService';
import { ChannelType } from '../../../supplier-integration/src/types';

/**
 * Triggered when the AI Parser detects the merchant saying:
 * "Register this group chat.whatsapp.com/xyz as my supplier for Ankara"
 */
export async function handleRegisterProcurementNodeIntent(
  merchantId: string, 
  rawText: string, 
  extractedLinkOrId: string,
  categories: string[]
) {
  console.log([AI Negotiator] Extracted REGISTER_PROCUREMENT_NODE intent from merchant.);
  
  // Determine channel type from link
  let channelType: ChannelType = 'whatsapp_direct';
  if (extractedLinkOrId.includes('chat.whatsapp.com')) channelType = 'whatsapp_group';
  else if (extractedLinkOrId.includes('t.me')) channelType = 'telegram_channel';
  else if (extractedLinkOrId.includes('instagram.com')) channelType = 'ig_dm';

  await procurementService.registerNode(merchantId, {
    merchantId,
    name: \Auto-Registered Node (\)\,
    channelType,
    channelId: extractedLinkOrId,
    categories,
    autoRestockEnabled: true
  });

  return "I have successfully registered that source as a Procurement Node. I will automatically send restock requests there when inventory drops.";
}
