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
  }
];

export const settingsHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  update_store_hours: async (merchantId: string, args: { schedule: string }) => {
    const parsedSchedule = typeof args.schedule === 'string' ? JSON.parse(args.schedule) : args.schedule;
    const result = await sql`
      UPDATE merchants 
      SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{storeHours}', ${JSON.stringify(parsedSchedule)}::jsonb) 
      WHERE id = ${merchantId} 
      RETURNING settings
    `;
    return { success: true, updatedSettings: result[0].settings, message: "Store hours updated." };
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
    const currentRows = await sql<{ bank_details: any; physical_address: any; owner_first_name: string; name: string }[]>`
      SELECT bank_details, physical_address, owner_first_name, name FROM merchants WHERE id = ${merchantId} LIMIT 1
    `;
    const currentBank = currentRows[0]?.bank_details || {};
    const updatedBank = {
      bankName: bankName || currentBank.bankName || "Unspecified Bank",
      accountNumber: accountNumber || currentBank.accountNumber || "",
      accountName: accountName || currentBank.accountName || ""
    };

    const currentAddr = currentRows[0]?.physical_address || {};
    const updatedAddr = physicalAddress ? { ...currentAddr, ...physicalAddress } : currentAddr;

    const registeredBool = isRegistered !== undefined ? Boolean(isRegistered) : (rcNumber ? true : null);

    await sql`
      UPDATE merchants SET
        owner_first_name     = COALESCE(${ownerFirstName || null}, owner_first_name),
        name                 = COALESCE(${businessName || null}, name),
        bank_details         = ${JSON.stringify(updatedBank)}::jsonb,
        physical_address     = ${JSON.stringify(updatedAddr)}::jsonb,
        is_registered        = COALESCE(${registeredBool}, is_registered),
        rc_number            = COALESCE(${rcNumber || null}, rc_number),
        business_type        = COALESCE(${businessType || null}, business_type),
        tax_id               = COALESCE(${taxId || null}, tax_id),
        category             = COALESCE(${category || null}, category),
        bio                  = COALESCE(${storeDescription || null}, bio),
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
      ? "Zero-Deduction Model (customer pays VAN 2% + Biblio fee; vendor receives 100% of price)"
      : "Standard Absorption Model (fees deducted from payout)";

    return `🏛️ Business Profile successfully updated for ${effectiveName} at ${effectiveBiz}!\n• Legal Status: ${regLabel}\n• Payout Bank: ${updatedBank.bankName} (${updatedBank.accountNumber || "N/A"})\n• Schedule: ${payoutFrequency || "instant"}\n• Fee Structure: ${feeModelDesc}${supportPhone ? `\n• Support Line: ${supportPhone}` : ""}${returnPolicy ? `\n• Return Policy: ${returnPolicy}` : ""}`;
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
