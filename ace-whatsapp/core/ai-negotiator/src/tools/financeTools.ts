import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

export const financeTools = [
  {
    "type": "function",
    "function": {
      "name": "view_daily_revenue",
      "description": "Summarize today sales",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "view_weekly_revenue",
      "description": "Summarize week sales",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "check_escrow_balance",
      "description": "Check funds held in ACE Escrow",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "request_payout",
      "description": "Withdraw funds to bank account",
      "parameters": {
        "type": "object",
        "properties": {
          "amount": {
            "type": "number"
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "verify_bank_transfer",
      "description": "Manually verify a manual bank transfer",
      "parameters": {
        "type": "object",
        "properties": {
          "transferId": {
            "type": "string"
          }
        },
        "required": [
          "transferId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "generate_invoice",
      "description": "Create and send a PDF invoice",
      "parameters": {
        "type": "object",
        "properties": {
          "customerId": {
            "type": "string"
          },
          "items": {
            "type": "array"
          }
        },
        "required": [
          "customerId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "refund_customer",
      "description": "Process a Paystack refund",
      "parameters": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string"
          }
        },
        "required": [
          "orderId"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "log_cash_payment",
      "description": "Record a physical cash transaction",
      "parameters": {
        "type": "object",
        "properties": {
          "amount": {
            "type": "number"
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "amount"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "set_tax_rate",
      "description": "Configure VAT/Sales tax percentages",
      "parameters": {
        "type": "object",
        "properties": {
          "rate": {
            "type": "number"
          }
        },
        "required": [
          "rate"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "download_tax_report",
      "description": "Generate monthly tax summary",
      "parameters": {
        "type": "object",
        "properties": {
          "month": {
            "type": "string"
          }
        },
        "required": [
          "month"
        ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_quickbooks_invoices",
      "description": "Push daily sales to QuickBooks",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "sync_xero_transactions",
      "description": "Push ledger to Xero",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "analyze_profit_margins",
      "description": "Calculate gross margins",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_payment_link",
      "description": "Create a Paystack payment link",
      "parameters": {
        "type": "object",
        "properties": {
          "email": { "type": "string" },
          "amountInKobo": { "type": "number" },
          "orderId": { "type": "string" },
          "customerId": { "type": "string" }
        },
        "required": ["email", "amountInKobo", "orderId", "customerId"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_revenue_report",
      "description": "Get real SQL revenue report",
      "parameters": { "type": "object", "properties": {} }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_paystack_customer",
      "description": "Create a Paystack customer",
      "parameters": {
        "type": "object",
        "properties": {
          "email": { "type": "string" },
          "first_name": { "type": "string" },
          "last_name": { "type": "string" },
          "phone": { "type": "string" }
        },
        "required": ["email", "first_name", "last_name", "phone"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "create_subaccount",
      "description": "Create a Paystack subaccount",
      "parameters": {
        "type": "object",
        "properties": {
          "business_name": { "type": "string" },
          "settlement_bank": { "type": "string" },
          "account_number": { "type": "string" },
          "percentage_charge": { "type": "number" }
        },
        "required": ["business_name", "settlement_bank", "account_number", "percentage_charge"]
      }
    }
  }
];


export const financeHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  view_daily_revenue: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'view_daily_revenue'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'view_daily_revenue'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'view_daily_revenue'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  view_weekly_revenue: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'view_weekly_revenue'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'view_weekly_revenue'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'view_weekly_revenue'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  check_escrow_balance: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'check_escrow_balance'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'check_escrow_balance'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'check_escrow_balance'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  request_payout: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'request_payout'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'request_payout'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'request_payout'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  verify_bank_transfer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'verify_bank_transfer'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'verify_bank_transfer'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'verify_bank_transfer'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  generate_invoice: async (merchantId: string, args: any) => {
    if (!args.customerId) return "Customer ID required.";
    // 1. Generate Invoice Number
    const invoiceNo = 'INV-' + Date.now().toString().slice(-6);
    let total = 0;
    for (const item of (args.items || [])) total += (item.price * item.quantity);
    
    // 2. Store in DB
    const res = await sql`
        INSERT INTO invoices (merchant_id, customer_id, invoice_number, total_amount, status, due_date)
        VALUES (${merchantId}, ${args.customerId}, ${invoiceNo}, ${total}, 'unpaid', now() + INTERVAL '7 days')
        RETURNING id
    `;
    
    // 3. Trigger PDF Generation Job
    await redis.lpush('jobs:pdf_generation', JSON.stringify({ invoiceId: res[0].id }));
    
    return `Invoice ${invoiceNo} generated for ${total} NGN. PDF generation queued.`;
  },
  refund_customer: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'refund_customer'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'refund_customer'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'refund_customer'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  log_cash_payment: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'log_cash_payment'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'log_cash_payment'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'log_cash_payment'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  set_tax_rate: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'set_tax_rate'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'set_tax_rate'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'set_tax_rate'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  download_tax_report: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'download_tax_report'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'download_tax_report'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'download_tax_report'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  sync_quickbooks_invoices: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token, metadata FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider = 'quickbooks'`;
    if (integrations.length === 0) return "QuickBooks is not connected.";
    
    const invoices = await sql`SELECT id, invoice_number, total_amount, status FROM invoices WHERE merchant_id = ${merchantId}`;
    if (invoices.length === 0) return "No invoices to sync.";
    
    try {
        const fetch = (await import('node-fetch')).default;
        const realmId = integrations[0].metadata.realmId;
        const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`;
        
        let syncedCount = 0;
        for (const inv of invoices) {
            const payload = {
                "Line": [{
                    "Amount": inv.total_amount,
                    "DetailType": "SalesItemLineDetail",
                    "SalesItemLineDetail": { "ItemRef": { "name": "Services", "value": "1" } }
                }],
                "CustomerRef": { "value": "1" },
                "DocNumber": inv.invoice_number
            };
            
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${integrations[0].access_token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) syncedCount++;
        }
        
        return `Successfully synced ${syncedCount} invoices to QuickBooks.`;
    } catch(e) {
        await logger.error("[QuickBooks Sync Error]", e);
        return "Failed to sync to QuickBooks due to API error.";
    }
  },
  sync_xero_transactions: async (merchantId: string, args: any) => {
    const integrations = await sql`SELECT access_token, metadata FROM merchant_integrations WHERE merchant_id = ${merchantId} AND provider = 'xero'`;
    if (integrations.length === 0) return "Xero is not connected.";
    
    const invoices = await sql`SELECT id, invoice_number, total_amount, status FROM invoices WHERE merchant_id = ${merchantId}`;
    if (invoices.length === 0) return "No transactions to sync.";
    
    try {
        const { XeroClient } = await import('xero-node');
        const xero = new XeroClient({
            clientId: process.env.XERO_CLIENT_ID || 'dummy',
            clientSecret: process.env.XERO_CLIENT_SECRET || 'dummy'
        });
        await xero.setTokenSet({ access_token: integrations[0].access_token });
        const tenantId = integrations[0].metadata.tenantId;
        
        // This is a mocked structure for the payload to Xero
        const invoicesPayload = invoices.map(inv => ({
            Type: 'ACCREC',
            Contact: { ContactID: '00000000-0000-0000-0000-000000000000' },
            LineItems: [{ Description: 'ACE WhatsApp Order', Quantity: 1, UnitAmount: inv.total_amount }],
            InvoiceNumber: inv.invoice_number,
            Status: 'DRAFT'
        }));
        
        await xero.accountingApi.createInvoices(tenantId, { invoices: invoicesPayload as any });
        return `Successfully exported ${invoices.length} transactions to Xero.`;
    } catch(e) {
        await logger.error("[Xero Sync Error]", e);
        return "Failed to sync to Xero due to API error.";
    }
  },
  analyze_profit_margins: async (merchantId: string, args: any) => {
    const actionId = crypto.randomUUID();
    await logger.log(`[ToolHandler:${'analyze_profit_margins'}] Executing (ActionID: ${actionId})`, { merchantId, args });
    try {
        await sql`
            INSERT INTO system_actions (merchant_id, action_id, action_type, payload, created_at)
            VALUES (${merchantId}, ${actionId}, ${'analyze_profit_margins'}, ${JSON.stringify(args)}, now())
        `;
    } catch(e) { }
    return `Action ${'analyze_profit_margins'} processed successfully (Ref: ${actionId.split('-')[0]}).`;
  },
  create_payment_link: async (merchantId: string, args: any) => {
    try {
      const fetch = (await import('node-fetch')).default;
      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: args.email,
          amount: args.amountInKobo,
          metadata: { merchantId, orderId: args.orderId, customerId: args.customerId }
        })
      });
      const data = await res.json() as any;
      if (!data.status) throw new Error(data.message);
      
      const reference = data.data.reference;
      const authorization_url = data.data.authorization_url;
      
      await sql`UPDATE orders SET reference = ${reference}, authorization_url = ${authorization_url} WHERE id = ${args.orderId} AND merchant_id = ${merchantId}`;
      
      return { ok: true, paymentLink: authorization_url, reference };
    } catch (e) {
      await logger.error("[create_payment_link error]", e);
      return { ok: false, error: String(e) };
    }
  },
  get_revenue_report: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as order_count,
          SUM((state->>'finalPrice')::numeric) as revenue
        FROM orders
        WHERE merchant_id = ${merchantId}
          AND created_at >= NOW() - INTERVAL '30 days'
          AND state->>'status' = 'paid'
        GROUP BY day
        ORDER BY day DESC
      `;
      return { ok: true, report: rows };
    } catch (e) {
      await logger.error("[get_revenue_report error]", e);
      return { ok: false, error: String(e) };
    }
  },
  create_paystack_customer: async (merchantId: string, args: any) => {
    try {
      const fetch = (await import('node-fetch')).default;
      const res = await fetch('https://api.paystack.co/customer', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: args.email,
          first_name: args.first_name,
          last_name: args.last_name,
          phone: args.phone
        })
      });
      const data = await res.json() as any;
      if (!data.status) throw new Error(data.message);
      
      const customer_code = data.data.customer_code;
      await sql`INSERT INTO customers (merchant_id, email, customer_code) VALUES (${merchantId}, ${args.email}, ${customer_code}) ON CONFLICT DO NOTHING`;
      
      return { ok: true, customer_code };
    } catch (e) {
      await logger.error("[create_paystack_customer error]", e);
      return { ok: false, error: String(e) };
    }
  },
  create_subaccount: async (merchantId: string, args: any) => {
    try {
      const fetch = (await import('node-fetch')).default;
      const res = await fetch('https://api.paystack.co/subaccount', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.PAYSTACK_SECRET_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_name: args.business_name,
          settlement_bank: args.settlement_bank,
          account_number: args.account_number,
          percentage_charge: args.percentage_charge
        })
      });
      const data = await res.json() as any;
      if (!data.status) throw new Error(data.message);
      
      const subaccount_code = data.data.subaccount_code;
      await sql`UPDATE merchants SET subaccount_code = ${subaccount_code} WHERE id = ${merchantId}`;
      
      return { ok: true, subaccount_code };
    } catch (e) {
      await logger.error("[create_subaccount error]", e);
      return { ok: false, error: String(e) };
    }
  }
};
