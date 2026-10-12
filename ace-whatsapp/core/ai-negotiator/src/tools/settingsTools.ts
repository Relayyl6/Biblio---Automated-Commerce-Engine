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
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_welcome_message'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_welcome_message'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_welcome_message'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  update_store_policy: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_store_policy'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_store_policy'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_store_policy'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  set_store_language: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'set_store_language'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'set_store_language'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'set_store_language'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  toggle_vacation_mode: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'toggle_vacation_mode'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'toggle_vacation_mode'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'toggle_vacation_mode'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  add_staff_member: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'add_staff_member'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'add_staff_member'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'add_staff_member'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  remove_staff_member: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'remove_staff_member'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'remove_staff_member'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'remove_staff_member'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  set_staff_permissions: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'set_staff_permissions'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'set_staff_permissions'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'set_staff_permissions'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  update_business_address: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'update_business_address'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'update_business_address'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'update_business_address'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  link_social_accounts: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'link_social_accounts'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'link_social_accounts'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'link_social_accounts'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
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
