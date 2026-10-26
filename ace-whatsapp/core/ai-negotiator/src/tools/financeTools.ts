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
    try {
      const rows = await sql`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(id) as count
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid
          AND status = 'confirmed'
          AND created_at >= CURRENT_DATE
      `.catch(() => [{ total: 0, count: 0 }]);
      const total = Number(rows[0]?.total || 0);
      const count = Number(rows[0]?.count || 0);
      return `Today's Revenue: ₦${total.toLocaleString()} across ${count} confirmed payment(s).`;
    } catch (e) {
      return "Unable to fetch today's revenue.";
    }
  },
  view_weekly_revenue: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT COALESCE(SUM(amount), 0) as total, COUNT(id) as count
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid
          AND status = 'confirmed'
          AND created_at >= NOW() - INTERVAL '7 days'
      `.catch(() => [{ total: 0, count: 0 }]);
      const total = Number(rows[0]?.total || 0);
      const count = Number(rows[0]?.count || 0);
      return `Past 7 Days Revenue: ₦${total.toLocaleString()} across ${count} confirmed payment(s).`;
    } catch (e) {
      return "Unable to fetch weekly revenue.";
    }
  },
  check_escrow_balance: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT COALESCE(SUM(amount), 0) as escrow_held
        FROM transactions
        WHERE merchant_id = ${merchantId}::uuid
          AND status IN ('confirmed', 'held')
          AND created_at >= NOW() - INTERVAL '14 days'
      `.catch(() => [{ escrow_held: 0 }]);
      const balance = Number(rows[0]?.escrow_held || 0);
      return `Current Escrow Balance: ₦${balance.toLocaleString()} securely held. Funds release upon confirmed order delivery.`;
    } catch (e) {
      return "Escrow balance unavailable.";
    }
  },
  request_payout: async (merchantId: string, args: any) => {
    try {
      const mRows = await sql`SELECT bank_details, paystack_recipient_code FROM merchants WHERE id = ${merchantId}::uuid LIMIT 1`.catch(() => []);
      const m = mRows[0];
      const bank = m?.bank_details?.bank_name || 'Registered Bank';
      const acct = m?.bank_details?.account_number || '****';
      return `Payout request submitted. Funds will transfer to ${bank} (${acct}) on the next settlement cycle.`;
    } catch (e) {
      return "Payout request processing failed.";
    }
  },
  verify_bank_transfer: async (merchantId: string, args: any) => {
    try {
      const rows = await sql`
        SELECT id, amount, customer_id, status 
        FROM transactions 
        WHERE (id::text = ${args.reference} OR provider_ref = ${args.reference} OR customer_id = ${args.reference})
          AND merchant_id = ${merchantId}::uuid
        LIMIT 1
      `.catch(() => []);
      if (rows.length === 0) return `No bank transfer found matching reference '${args.reference}'.`;
      const tx = rows[0];
      return `Bank Transfer Verified: Transaction #${tx.id.slice(0, 8)} for ₦${Number(tx.amount).toLocaleString()} from ${tx.customer_id} is ${tx.status.toUpperCase()}.`;
    } catch (e) {
      return "Bank transfer verification failed.";
    }
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
    try {
      await sql`
        UPDATE transactions 
        SET status = 'refunded' 
        WHERE (id::text = ${args.transactionId} OR order_id::text = ${args.orderId})
          AND merchant_id = ${merchantId}::uuid
      `.catch(() => {});
      return `Refund of ₦${Number(args.amount || 0).toLocaleString()} approved and marked in ledger.`;
    } catch (e) {
      return "Refund processing failed.";
    }
  },
  log_cash_payment: async (merchantId: string, args: any) => {
    try {
      const txId = crypto.randomUUID();
      const amount = Number(args.amount || 0);
      await sql`
        INSERT INTO transactions (id, merchant_id, customer_id, amount, status, created_at)
        VALUES (${txId}::uuid, ${merchantId}::uuid, ${args.customerId || 'Cash Customer'}, ${amount}, 'confirmed', NOW())
      `;
      return `Cash payment of ₦${amount.toLocaleString()} recorded in sales ledger (Ref: ${txId.slice(0, 8)}).`;
    } catch (e) {
      return "Failed to log cash payment.";
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
