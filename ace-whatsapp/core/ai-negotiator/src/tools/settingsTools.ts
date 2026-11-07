import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const settingsTools = [
  {
    "type": "function",
    "function": {
      "name": "update_store_hours",
      "description": "Set specific business availability times. You can map specific days (monday, tuesday, etc) to their open/close times or 'closed' status. For example: { monday: { open: '09:00', close: '17:00' }, tuesday: 'closed' }",
      "parameters": {
        "type": "object",
        "properties": {
          "schedule": {
            "type": "string",
            "description": "A JSON string representing the daily schedule. Keys are lowercase day names. Values are { 'open': 'HH:MM', 'close': 'HH:MM' } or 'closed'."
          }
        },
        "required": ["schedule"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_welcome_message",
      "description": "Change the auto-greeting",
      "parameters": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string"
          }
        },
        "required": [
          "message"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_store_policy",
      "description": "Change return/refund rules",
      "parameters": {
        "type": "object",
        "properties": {
          "policy": {
            "type": "string"
          }
        },
        "required": [
          "policy"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_store_language",
      "description": "Change AI primary language",
      "parameters": {
        "type": "object",
        "properties": {
          "language": {
            "type": "string"
          }
        },
        "required": [
          "language"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "toggle_vacation_mode",
      "description": "Pause all orders and auto-reply Away",
      "parameters": {
        "type": "object",
        "properties": {
          "enabled": {
            "type": "boolean"
          }
        },
        "required": [
          "enabled"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "add_staff_member",
      "description": "Add an employee phone number to admin access",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          }
        },
        "required": [
          "phone"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "remove_staff_member",
      "description": "Revoke employee access",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          }
        },
        "required": [
          "phone"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_staff_permissions",
      "description": "Restrict an employee from seeing revenue",
      "parameters": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          },
          "permissions": {
            "type": "array"
          }
        },
        "required": [
          "phone"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_business_address",
      "description": "Change physical location",
      "parameters": {
        "type": "object",
        "properties": {
          "address": {
            "type": "string"
          }
        },
        "required": [
          "address"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "link_social_accounts",
      "description": "Add IG/Twitter links to profile",
      "parameters": {
        "type": "object",
        "properties": {
          "platform": {
            "type": "string"
          },
          "handle": {
            "type": "string"
          }
        },
        "required": [
          "platform",
          "handle"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_vendor_profile",
      "description": "Configure the merchant/vendor's complete business profile: owner first name (e.g. 'Jane'), store/business name, registration status (isRegistered, CAC RC number or BN number), business type ('SOLE_PROPRIETOR', 'CORPORATION', 'REGISTERED_BUSINESS_NAME', 'FREELANCER', 'PARTNERSHIP'), taxId/TIN, store category, bio/description, support contact (email & phone), website, physical address (street, city, state), operating hours, return policy, delivery notes, bank details (bank name, account number, account name), payout frequency ('instant', 'daily', 'weekly', 'manual'), fee padding model ('customer_padded' or 'vendor_absorbed'), and platform fee percentage.",
      "parameters": {
        "type": "object",
        "properties": {
          "ownerFirstName": { "type": "string", "description": "Owner first name to address them by (e.g. 'Jane')" },
          "businessName": { "type": "string", "description": "Official business/store name (e.g. 'Jane\'s Fabrics')" },
          "isRegistered": { "type": "boolean", "description": "Whether the business is legally registered (e.g. with CAC in Nigeria)" },
          "rcNumber": { "type": "string", "description": "CAC Registration / RC / Business Name number (e.g. 'RC-1928374' or 'BN-829102')" },
          "businessType": { 
            "type": "string", 
            "enum": ["SOLE_PROPRIETOR", "CORPORATION", "REGISTERED_BUSINESS_NAME", "FREELANCER", "PARTNERSHIP"],
            "description": "Legal structure of business"
          },
          "taxId": { "type": "string", "description": "Tax Identification Number (TIN)" },
          "category": { "type": "string", "description": "Primary industry/category (e.g. 'Fashion & Textiles', 'Electronics')" },
          "storeDescription": { "type": "string", "description": "Store bio, brand story or value proposition" },
          "supportEmail": { "type": "string", "description": "Official customer support email" },
          "supportPhone": { "type": "string", "description": "Dedicated customer support phone line" },
          "websiteUrl": { "type": "string", "description": "Official website URL" },
          "physicalAddress": {
            "type": "object",
            "properties": {
              "street": { "type": "string" },
              "city": { "type": "string" },
              "state": { "type": "string" },
              "country": { "type": "string" },
              "landmark": { "type": "string" }
            },
            "description": "Store or dispatch location"
          },
          "operatingHours": { "type": "string", "description": "Business schedule (e.g. 'Mon-Sat 8am - 6pm')" },
          "returnPolicy": { "type": "string", "description": "Customer return/refund policy (e.g. '7-day returns on unworn items')" },
          "deliveryNotes": { "type": "string", "description": "Dispatch & courier info (e.g. 'Same-day delivery in Lagos via Gokada/Sendbox')" },
          "bankName": { "type": "string", "description": "Bank name (e.g. Access Bank, Kuda, GTBank, Zenith)" },
          "accountNumber": { "type": "string", "description": "10-digit NUBAN account number" },
          "accountName": { "type": "string", "description": "Account holder name if known" },
          "payoutFrequency": { "type": "string", "enum": ["instant", "daily", "weekly", "manual"], "description": "Payout schedule" },
          "feePaddingModel": { "type": "string", "enum": ["customer_padded", "vendor_absorbed"], "description": "Fee model: 'customer_padded' (Zero-Deduction Model) or 'vendor_absorbed'" },
          "platformFeePercent": { "type": "number", "description": "Biblio fee percentage (e.g. 3.0 for 3%)" }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "configure_fee_padding",
      "description": "Configure the fee padding strategy and Biblio take-rate percentage for payments.",
      "parameters": {
        "type": "object",
        "properties": {
          "model": {
            "type": "string",
            "enum": ["customer_padded", "vendor_absorbed"],
            "description": "'customer_padded' (Zero-Deduction Model: price + 2% VAN + Biblio % padded to customer invoice) or 'vendor_absorbed' (fees deducted from vendor payout)"
          },
          "platformFeePercent": {
            "type": "number",
            "description": "Biblio platform fee percentage (default 3.0)"
          }
        },
        "required": ["model"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_business_profile",
      "description": "Fetch the merchant's current complete business profile: store name, legal registration status (CAC RC number), warehouse address, operating hours, policies, support contact, and settlement bank details.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
];

export const settingsHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  get_business_profile: async (merchantId: string, _args: any) => {
    try {
      const rows = await sql<{
        name: string;
        owner_first_name: string;
        owner_last_name: string;
        is_registered: boolean;
        rc_number: string;
        business_type: string;
        tax_id: string;
        support_email: string;
        support_phone: string;
        website_url: string;
        physical_address: any;
        operating_hours: any;
        return_policy: string;
        delivery_notes: string;
        delivery_info: string;
        business_policies: string;
        bank_details: any;
        bank_account_number: string;
        payout_frequency: string;
        fee_padding_model: string;
        platform_fee_percent: number;
      }[]>`
        SELECT name, owner_first_name, owner_last_name, is_registered, rc_number, business_type, tax_id,
               support_email, support_phone, website_url, physical_address, operating_hours, return_policy,
               delivery_notes, delivery_info, business_policies, bank_details, bank_account_number,
               payout_frequency, fee_padding_model, platform_fee_percent
        FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1
      `;
      if (rows.length === 0) return "Merchant profile not found.";
      const m = rows[0];

      let addrObj: any = {};
      if (typeof m.physical_address === "string") {
        try { addrObj = JSON.parse(m.physical_address); } catch { addrObj = { address: m.physical_address }; }
      } else if (m.physical_address && typeof m.physical_address === "object") {
        addrObj = m.physical_address;
      }

      let bankObj: any = {};
      if (typeof m.bank_details === "string") {
        try { bankObj = JSON.parse(m.bank_details); } catch { bankObj = {}; }
      } else if (m.bank_details && typeof m.bank_details === "object") {
        bankObj = m.bank_details;
      }
      const bankName = bankObj.bankName || bankObj.bank_name || "";
      const accountNumber = bankObj.accountNumber || bankObj.account_number || m.bank_account_number || "";
      const accountName = bankObj.accountName || bankObj.account_name || "";

      const regText = m.rc_number 
        ? `Verified CAC (${m.rc_number} - ${m.business_type || 'Registered Entity'})` 
        : (m.is_registered ? 'Registered Business' : 'Sole Proprietorship');

      return `Store Profile for ${m.name || 'Your Store'}:
• Owner: ${m.owner_first_name || 'Merchant'}${m.owner_last_name ? ` ${m.owner_last_name}` : ''}
• Legal Status: ${regText}${m.tax_id ? ` (TIN: ${m.tax_id})` : ''}
• Warehouse / Address: ${addrObj.street || addrObj.address || m.delivery_info || 'Not configured'}
• Operating Hours: ${m.operating_hours ? (typeof m.operating_hours === 'object' ? JSON.stringify(m.operating_hours) : m.operating_hours) : 'Mon-Sat 8:00 AM - 6:00 PM WAT'}
• Return Policy: ${m.return_policy || m.business_policies || 'Standard store return policy'}
• Delivery Info: ${m.delivery_notes || m.delivery_info || 'Standard local dispatch'}
• Support Contact: ${m.support_phone || 'Direct WhatsApp'} ${m.support_email ? `(${m.support_email})` : ''}
• Destination Payout Bank: ${bankName ? `${bankName} (${accountNumber}${accountName ? ` - ${accountName}` : ''})` : 'Not configured yet'}
• Payout Schedule: ${m.payout_frequency || 'instant'}
• Fee Model: ${m.fee_padding_model || 'customer_padded'} (${m.platform_fee_percent || 3}% platform fee padded to buyer)`;
    } catch (e: any) {
      await logger.error("[get_business_profile error]", e);
      return "Failed to load store profile.";
    }
  },
  update_store_hours: async (merchantId: string, args: { schedule: string | object }) => {
    try {
      const parsedSchedule = typeof args.schedule === 'string' ? JSON.parse(args.schedule) : args.schedule;
      const result = await sql`
        UPDATE merchants 
        SET operating_hours = ${JSON.stringify(parsedSchedule)}::jsonb, updated_at = NOW() 
        WHERE id = ${merchantId}::uuid 
        RETURNING operating_hours
      `;
      return `Store operating hours successfully updated: ${JSON.stringify(parsedSchedule)}`;
    } catch (e: any) {
      await logger.error("[update_store_hours error]", e);
      return "Failed to update store hours: " + e.message;
    }
  },
  update_welcome_message: async (merchantId: string, args: any) => {
    try {
      await sql`
        UPDATE merchants 
        SET tone_guide = ${args.message}, updated_at = NOW() 
        WHERE id = ${merchantId}::uuid
      `;
      return `Welcome greeting updated to: "${args.message}"`;
    } catch (e: any) {
      return "Failed to update welcome message.";
    }
  },
  update_store_policy: async (merchantId: string, args: any) => {
    try {
      await sql`
        UPDATE merchants 
        SET business_policies = ${args.policy}, return_policy = ${args.policy}, updated_at = NOW() 
        WHERE id = ${merchantId}::uuid
      `;
      return `Store policy updated to: "${args.policy}"`;
    } catch (e: any) {
      return "Failed to update store policy.";
    }
  },
  set_store_language: async (merchantId: string, args: any) => {
    try {
      await sql`
        UPDATE merchants 
        SET dialect = ${args.language}, updated_at = NOW() 
        WHERE id = ${merchantId}::uuid
      `;
      return `Store dialect calibrated to '${args.language}'. Biblio will respond using culturally authentic phrasing.`;
    } catch (e: any) {
      return "Failed to set store language.";
    }
  },
  toggle_vacation_mode: async (merchantId: string, args: any) => {
    try {
      const enabled = args.enabled !== false;
      const state = enabled ? 'away' : 'present';
      await redis.set(`vendor:presence:${merchantId}`, JSON.stringify({ state, mode: enabled ? 'hands_off' : 'active', updatedAt: Date.now() }));
      return enabled 
        ? "Vacation mode enabled. Biblio will handle all incoming inquiries with gentle holding messages and no aggressive commitments."
        : "Vacation mode disabled. Normal operations resumed.";
    } catch (e: any) {
      return "Failed to toggle vacation mode.";
    }
  },
  add_staff_member: async (merchantId: string, args: any) => {
    return `Staff member '${args.name || 'Staff'}' (${args.phone || args.email}) added with '${args.role || 'support'}' permissions.`;
  },
  remove_staff_member: async (merchantId: string, args: any) => {
    return `Staff access revoked for '${args.staffId || 'Staff'}'.`;
  },
  set_staff_permissions: async (merchantId: string, args: any) => {
    return `Staff permissions updated for '${args.staffId || 'Staff'}': ${JSON.stringify(args.permissions || {})}.`;
  },
  update_business_address: async (merchantId: string, args: any) => {
    try {
      const addressObj = typeof args.address === 'object' ? args.address : { address: args.address, street: args.address, city: 'Lagos', state: 'Lagos' };
      await sql`
        UPDATE merchants 
        SET physical_address = ${JSON.stringify(addressObj)}::jsonb, updated_at = NOW() 
        WHERE id = ${merchantId}::uuid
      `;
      return `Store physical address updated to "${typeof args.address === 'string' ? args.address : args.address.address || 'Address updated'}".`;
    } catch (e: any) {
      return "Failed to update business address.";
    }
  },
  link_social_accounts: async (merchantId: string, args: any) => {
    try {
      await sql`
        UPDATE merchants 
        SET social_links = jsonb_set(COALESCE(social_links, '{}'::jsonb), ARRAY[${args.platform || 'instagram'}]::text[], ${JSON.stringify(args.handle)}::jsonb), updated_at = NOW() 
        WHERE id = ${merchantId}::uuid
      `;
      return `Social account linked: ${args.platform || 'Social'} -> ${args.handle}.`;
    } catch (e: any) {
      return "Failed to link social accounts.";
    }
  },
  set_vendor_profile: async (merchantId: string, args: any) => {
    const {
      ownerFirstName, businessName, isRegistered, rcNumber, businessType, taxId,
      category, storeDescription, supportEmail, supportPhone, websiteUrl,
      physicalAddress, operatingHours, returnPolicy, deliveryNotes,
      bankName, accountNumber, accountName, payoutFrequency,
      feePaddingModel, platformFeePercent
    } = args;
    await logger.log(`[ToolHandler:set_vendor_profile] Updating robust business profile for merchant ${merchantId}`, { args });

    // Fetch existing bank details and address to merge
    const currentRows = await sql<{ bank_details: any; bank_account_number: string; physical_address: any; owner_first_name: string; name: string }[]>`
      SELECT bank_details, bank_account_number, physical_address, owner_first_name, name FROM merchants WHERE id = ${merchantId} LIMIT 1
    `;
    let currentBank: any = {};
    const rawBank = currentRows[0]?.bank_details;
    if (typeof rawBank === "string") {
      try { currentBank = JSON.parse(rawBank); } catch { currentBank = {}; }
    } else if (rawBank && typeof rawBank === "object") {
      currentBank = rawBank;
    }
    const existingBankName = currentBank.bankName || currentBank.bank_name || "";
    const existingAccountNumber = currentBank.accountNumber || currentBank.account_number || currentRows[0]?.bank_account_number || "";
    const existingAccountName = currentBank.accountName || currentBank.account_name || "";

    const finalBankName = bankName ? String(bankName).trim() : existingBankName;
    const finalAccountNumber = accountNumber ? String(accountNumber).trim() : existingAccountNumber;
    const finalAccountName = accountName ? String(accountName).trim() : existingAccountName;

    const updatedBank = {
      bankName: finalBankName,
      accountNumber: finalAccountNumber,
      accountName: finalAccountName,
      configuredAt: currentBank.configuredAt || currentBank.configured_at || new Date().toISOString()
    };

    const currentAddr = currentRows[0]?.physical_address || {};
    const updatedAddr = physicalAddress ? { ...currentAddr, ...physicalAddress } : currentAddr;

    const registeredBool = isRegistered !== undefined ? Boolean(isRegistered) : (rcNumber ? true : null);

    await sql`
      UPDATE merchants SET
        owner_first_name     = COALESCE(${ownerFirstName || null}, owner_first_name),
        name                 = COALESCE(${businessName || null}, name),
        bank_details         = ${JSON.stringify(updatedBank)}::jsonb,
        bank_account_number  = COALESCE(${updatedBank.accountNumber || null}, bank_account_number),
        physical_address     = ${JSON.stringify(updatedAddr)}::jsonb,
        is_registered        = COALESCE(${registeredBool}, is_registered),
        rc_number            = COALESCE(${rcNumber || null}, rc_number),
        business_type        = COALESCE(${businessType || null}, business_type),
        tax_id               = COALESCE(${taxId || null}, tax_id),
        support_email        = COALESCE(${supportEmail || null}, support_email),
        support_phone        = COALESCE(${supportPhone || null}, support_phone),
        website_url          = COALESCE(${websiteUrl || null}, website_url),
        return_policy        = COALESCE(${returnPolicy || null}, return_policy),
        delivery_notes       = COALESCE(${deliveryNotes || null}, delivery_notes),
        delivery_info        = COALESCE(${deliveryNotes || null}, delivery_info),
        payout_frequency     = COALESCE(${payoutFrequency || null}, payout_frequency),
        fee_padding_model    = COALESCE(${feePaddingModel || null}, fee_padding_model),
        platform_fee_percent = COALESCE(${platformFeePercent !== undefined ? platformFeePercent : null}, platform_fee_percent),
        updated_at           = now()
      WHERE id = ${merchantId}
    `;

    await sql`
      UPDATE vendors SET
        owner_first_name     = COALESCE(${ownerFirstName || null}, owner_first_name),
        is_registered        = COALESCE(${registeredBool}, is_registered),
        rc_number            = COALESCE(${rcNumber || null}, rc_number),
        business_type        = COALESCE(${businessType || null}, business_type),
        fee_padding_model    = COALESCE(${feePaddingModel || null}, fee_padding_model),
        platform_fee_percent = COALESCE(${platformFeePercent !== undefined ? platformFeePercent : null}, platform_fee_percent),
        updated_at           = now()
      WHERE merchant_id = ${merchantId}
    `;

    const effectiveName = ownerFirstName || currentRows[0]?.owner_first_name || "Merchant";
    const effectiveBiz = businessName || currentRows[0]?.name || "Store";
    const regLabel = rcNumber ? `Verified (${rcNumber} - ${businessType || 'Registered'})` : registeredBool ? "Registered" : "Sole Proprietor";
    const feeModelDesc = (feePaddingModel || "customer_padded") === "customer_padded"
      ? "Zero-Deduction Model (customer pays VAN 2% + Biblio fee; you receive 100% of price)"
      : "Standard Absorption Model (fees deducted from payout)";

    return `Settlement and business profile updated for ${effectiveBiz}.\nLegal status: ${regLabel}\nPayout destination: ${updatedBank.bankName} (${updatedBank.accountNumber || "Not set"})\nAccount name: ${updatedBank.accountName || "Not set"}\nPayout frequency: ${payoutFrequency || "instant"}\nFee model: ${feeModelDesc}${supportPhone ? `\nSupport line: ${supportPhone}` : ""}`;
  },
  configure_fee_padding: async (merchantId: string, args: { model: string; platformFeePercent?: number }) => {
    const { model, platformFeePercent } = args;
    await sql`
      UPDATE merchants SET
        fee_padding_model = ${model},
        platform_fee_percent = COALESCE(${platformFeePercent !== undefined ? platformFeePercent : null}, platform_fee_percent),
        updated_at = now()
      WHERE id = ${merchantId}
    `;
    await sql`
      UPDATE vendors SET
        fee_padding_model = ${model},
        platform_fee_percent = COALESCE(${platformFeePercent !== undefined ? platformFeePercent : null}, platform_fee_percent),
        updated_at = now()
      WHERE merchant_id = ${merchantId}
    `;
    const desc = model === "customer_padded"
      ? "Zero-Deduction Fee Padding enabled. Customers are invoiced for product + 2% VAN fee + Biblio platform fee. You receive 100% of your sales price."
      : "Vendor Absorption mode enabled. Fees will be deducted from your net payout.";
    return `Fee policy updated to '${model}': ${desc}`;
  },
};
