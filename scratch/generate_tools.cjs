const fs = require('fs');
const path = require('path');

const outDir = 'C:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/tools';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

function makeTool(name, desc, props = {}, required = []) {
    return {
        type: 'function',
        function: {
            name,
            description: desc,
            parameters: {
                type: 'object',
                properties: props,
                required: required.length ? required : undefined
            }
        }
    };
}

const domains = {
    inventoryTools: [
        makeTool('add_inventory', 'Add new products to the catalog', { name: {type:'string'}, price: {type:'number'}, stock: {type:'number'} }, ['name', 'price']),
        makeTool('update_inventory', 'Modify prices or restock quantities', { sku: {type:'string'}, price: {type:'number'}, stock: {type:'number'} }, ['sku']),
        makeTool('delete_inventory', 'Remove products from the catalog', { sku: {type:'string'} }, ['sku']),
        makeTool('search_inventory', 'Query stock levels', { query: {type:'string'} }, ['query']),
        makeTool('auto_restock_alert_config', 'Set low-stock thresholds', { sku: {type:'string'}, threshold: {type:'number'} }, ['sku', 'threshold']),
        makeTool('bulk_price_update', 'Increase or decrease prices in bulk', { category: {type:'string'}, percentage: {type:'number'} }, ['percentage']),
        makeTool('generate_product_description', 'AI-generate descriptions', { sku: {type:'string'} }, ['sku']),
        makeTool('categorize_product', 'Assign tags/categories', { sku: {type:'string'}, tags: {type:'array', items:{type:'string'}} }, ['sku', 'tags']),
        makeTool('sync_shopify_inventory', 'Pull inventory from Shopify', {}),
        makeTool('push_to_woocommerce', 'Sync ACE catalog to WooCommerce', {}),
        makeTool('list_out_of_stock', 'Show all out-of-stock items', {}),
        makeTool('archive_product', 'Archive a seasonal product', { sku: {type:'string'} }, ['sku']),
        makeTool('unarchive_product', 'Restore an archived product', { sku: {type:'string'} }, ['sku']),
        makeTool('add_product_variant', 'Add sizes/colors to existing product', { sku: {type:'string'}, variantName: {type:'string'}, price: {type:'number'} }, ['sku', 'variantName']),
        makeTool('remove_product_variant', 'Remove sizes/colors', { sku: {type:'string'}, variantId: {type:'string'} }, ['sku', 'variantId']),
        makeTool('set_minimum_order_quantity', 'Set MOQs for wholesale', { sku: {type:'string'}, moq: {type:'number'} }, ['sku', 'moq'])
    ],
    orderTools: [
        makeTool('view_pending_orders', 'List orders awaiting fulfillment', {}),
        makeTool('mark_order_shipped', 'Update status and notify buyer', { orderId: {type:'string'}, trackingNumber: {type:'string'} }, ['orderId']),
        makeTool('cancel_order', 'Cancel and trigger refund', { orderId: {type:'string'}, reason: {type:'string'} }, ['orderId']),
        makeTool('resend_order_receipt', 'Send receipt to customer', { orderId: {type:'string'} }, ['orderId']),
        makeTool('update_shipping_address', 'Fix a customer address', { orderId: {type:'string'}, newAddress: {type:'string'} }, ['orderId', 'newAddress']),
        makeTool('schedule_pickup', 'Request logistics partner pickup', { orderId: {type:'string'}, partner: {type:'string'} }, ['orderId']),
        makeTool('track_shipment', 'Check courier tracking status', { trackingNumber: {type:'string'} }, ['trackingNumber']),
        makeTool('calculate_shipping_rate', 'Get live rates for a destination', { destination: {type:'string'}, weight: {type:'number'} }, ['destination']),
        makeTool('print_shipping_label', 'Generate label PDF for a specific order', { orderId: {type:'string'} }, ['orderId']),
        makeTool('split_order', 'Split a large order into multiple shipments', { orderId: {type:'string'}, itemIds: {type:'array', items:{type:'string'}} }, ['orderId']),
        makeTool('merge_orders', 'Combine multiple orders for one customer', { orderIds: {type:'array', items:{type:'string'}} }, ['orderIds']),
        makeTool('flag_fraudulent_order', 'Report suspicious orders', { orderId: {type:'string'}, reason: {type:'string'} }, ['orderId'])
    ],
    crmTools: [
        makeTool('get_customer_profile', 'View a customer history', { customerId: {type:'string'} }, ['customerId']),
        makeTool('tag_customer', 'Add tags to a customer', { customerId: {type:'string'}, tag: {type:'string'} }, ['customerId', 'tag']),
        makeTool('block_customer', 'Block a number from ordering', { customerId: {type:'string'} }, ['customerId']),
        makeTool('unblock_customer', 'Remove a block', { customerId: {type:'string'} }, ['customerId']),
        makeTool('send_broadcast_message', 'Blast a message to tagged customers', { tag: {type:'string'}, message: {type:'string'} }, ['message']),
        makeTool('sync_hubspot_contacts', 'Export ACE buyers to HubSpot CRM', {}),
        makeTool('sync_salesforce_leads', 'Export leads to Salesforce', {}),
        makeTool('create_hubspot_ticket', 'Open a support ticket in HubSpot', { customerId: {type:'string'}, issue: {type:'string'} }, ['issue']),
        makeTool('resolve_hubspot_ticket', 'Close a ticket', { ticketId: {type:'string'} }, ['ticketId']),
        makeTool('add_customer_note', 'Add a private CRM note to a buyer profile', { customerId: {type:'string'}, note: {type:'string'} }, ['customerId', 'note']),
        makeTool('get_top_customers', 'List top 10 buyers by lifetime value', {}),
        makeTool('offer_loyalty_discount', 'Automatically send a discount to a loyal customer', { customerId: {type:'string'}, discountPercentage: {type:'number'} }, ['customerId', 'discountPercentage']),
        makeTool('schedule_follow_up', 'Remind the vendor to follow up', { customerId: {type:'string'}, days: {type:'number'} }, ['customerId', 'days']),
        makeTool('churn_risk_analysis', 'Identify customers who haven\'t bought recently', {})
    ],
    negotiationTools: [
        makeTool('resolve_escalation', 'Step into a live AI negotiation', { customerId: {type:'string'}, decision: {type:'string', enum:['approve', 'reject', 'counter_offer']}, amount: {type:'number'} }, ['customerId', 'decision']),
        makeTool('set_floor_price', 'Set the absolute minimum price for an item', { sku: {type:'string'}, floorPrice: {type:'number'} }, ['sku', 'floorPrice']),
        makeTool('override_ai_offer', 'Manually push a specific price to a buyer', { customerId: {type:'string'}, amount: {type:'number'} }, ['customerId', 'amount']),
        makeTool('create_discount_code', 'Generate a promo code', { code: {type:'string'}, percentage: {type:'number'} }, ['code', 'percentage']),
        makeTool('disable_discount_code', 'Revoke a promo code', { code: {type:'string'} }, ['code']),
        makeTool('configure_negotiation_aggressiveness', 'Set AI to firm vs flexible', { mode: {type:'string', enum:['firm', 'balanced', 'flexible']} }, ['mode']),
        makeTool('enable_bundle_deals', 'Allow AI to offer buy 2 get 1', { enabled: {type:'boolean'} }, ['enabled']),
        makeTool('review_negotiation_transcripts', 'Read exactly what the AI said', { customerId: {type:'string'} }, ['customerId']),
        makeTool('approve_custom_quote', 'Approve a B2B quote request', { quoteId: {type:'string'} }, ['quoteId']),
        makeTool('reject_custom_quote', 'Decline a B2B quote', { quoteId: {type:'string'} }, ['quoteId'])
    ],
    financeTools: [
        makeTool('view_daily_revenue', 'Summarize today sales', {}),
        makeTool('view_weekly_revenue', 'Summarize week sales', {}),
        makeTool('check_escrow_balance', 'Check funds held in ACE Escrow', {}),
        makeTool('request_payout', 'Withdraw funds to bank account', { amount: {type:'number'} }),
        makeTool('verify_bank_transfer', 'Manually verify a manual bank transfer', { transferId: {type:'string'} }, ['transferId']),
        makeTool('generate_invoice', 'Create and send a PDF invoice', { customerId: {type:'string'}, items: {type:'array'} }, ['customerId']),
        makeTool('refund_customer', 'Process a Paystack refund', { orderId: {type:'string'} }, ['orderId']),
        makeTool('log_cash_payment', 'Record a physical cash transaction', { amount: {type:'number'}, description: {type:'string'} }, ['amount']),
        makeTool('set_tax_rate', 'Configure VAT/Sales tax percentages', { rate: {type:'number'} }, ['rate']),
        makeTool('download_tax_report', 'Generate monthly tax summary', { month: {type:'string'} }, ['month']),
        makeTool('sync_quickbooks_invoices', 'Push daily sales to QuickBooks', {}),
        makeTool('sync_xero_transactions', 'Push ledger to Xero', {}),
        makeTool('analyze_profit_margins', 'Calculate gross margins', {})
    ],
    marketingTools: [
        makeTool('configure_status_mode', 'Toggle auto-posting to Status', { enabled: {type:'boolean'} }, ['enabled']),
        makeTool('post_to_status_now', 'Immediately push a specific product', { sku: {type:'string'} }, ['sku']),
        makeTool('generate_marketing_copy', 'AI writes Instagram/Facebook captions', { sku: {type:'string'} }, ['sku']),
        makeTool('schedule_status_campaign', 'Plan status posts for the week', { skus: {type:'array', items:{type:'string'}} }, ['skus']),
        makeTool('analyze_status_views', 'Check view counts', {}),
        makeTool('create_flash_sale', 'Automatically slash prices for 24h', { percentage: {type:'number'} }, ['percentage']),
        makeTool('end_flash_sale', 'Revert prices back to normal', {}),
        makeTool('sync_facebook_catalog', 'Push ACE products to FB Shop', {}),
        makeTool('sync_instagram_shop', 'Push to IG Shopping', {}),
        makeTool('run_abandoned_cart_recovery', 'SMS blast to abandoned carts', {})
    ],
    analyticsTools: [
        makeTool('query_audit_logs', 'Search system logs', { query: {type:'string'} }, ['query']),
        makeTool('generate_sales_forecast', 'AI predicts next month sales', {}),
        makeTool('analyze_peak_hours', 'Find out when customers message the most', {}),
        makeTool('analyze_popular_products', 'Find out which items are viewed most', {}),
        makeTool('get_competitor_pricing', 'Check average market price for a SKU', { sku: {type:'string'} }, ['sku']),
        makeTool('export_sales_data', 'Generate a CSV of all sales', {}),
        makeTool('generate_business_health_score', 'Comprehensive rating of business ops', {}),
        makeTool('customer_sentiment_analysis', 'Gauge if customers are happy or frustrated', {}),
        makeTool('inventory_turnover_rate', 'Calculate how fast items sell', {})
    ],
    settingsTools: [
        makeTool('update_store_hours', 'Set open/close times', { open: {type:'string'}, close: {type:'string'} }, ['open', 'close']),
        makeTool('update_welcome_message', 'Change the auto-greeting', { message: {type:'string'} }, ['message']),
        makeTool('update_store_policy', 'Change return/refund rules', { policy: {type:'string'} }, ['policy']),
        makeTool('set_store_language', 'Change AI primary language', { language: {type:'string'} }, ['language']),
        makeTool('toggle_vacation_mode', 'Pause all orders and auto-reply Away', { enabled: {type:'boolean'} }, ['enabled']),
        makeTool('add_staff_member', 'Add an employee phone number to admin access', { phone: {type:'string'} }, ['phone']),
        makeTool('remove_staff_member', 'Revoke employee access', { phone: {type:'string'} }, ['phone']),
        makeTool('set_staff_permissions', 'Restrict an employee from seeing revenue', { phone: {type:'string'}, permissions: {type:'array'} }, ['phone']),
        makeTool('update_business_address', 'Change physical location', { address: {type:'string'} }, ['address']),
        makeTool('link_social_accounts', 'Add IG/Twitter links to profile', { platform: {type:'string'}, handle: {type:'string'} }, ['platform', 'handle'])
    ],
    integrationTools: [
        makeTool('register_webhook', 'Send ACE events to a custom vendor URL', { url: {type:'string'}, event: {type:'string'} }, ['url', 'event']),
        makeTool('remove_webhook', 'Delete a custom webhook', { webhookId: {type:'string'} }, ['webhookId']),
        makeTool('connect_mailchimp', 'Sync emails for newsletters', { apiKey: {type:'string'} }, ['apiKey']),
        makeTool('connect_zapier', 'Generate Zapier integration key', {}),
        makeTool('connect_slack', 'Route escalation alerts to a Slack channel', { webhookUrl: {type:'string'} }, ['webhookUrl']),
        makeTool('connect_discord', 'Route alerts to Discord', { webhookUrl: {type:'string'} }, ['webhookUrl']),
        makeTool('sync_google_sheets', 'Live sync all orders to a GSheet', { sheetUrl: {type:'string'} }, ['sheetUrl']),
        makeTool('generate_api_key', 'Create key for headless custom storefronts', {})
    ],
    bookingTools: [
        makeTool('book_appointment', 'Book a time slot for a service', { serviceId: {type:'string'}, time: {type:'string'}, customerId: {type:'string'} }, ['serviceId', 'time']),
        makeTool('check_calendar_availability', 'See open slots for a specific date', { date: {type:'string'}, staffId: {type:'string'} }, ['date']),
        makeTool('cancel_appointment', 'Cancel an existing appointment', { appointmentId: {type:'string'} }, ['appointmentId']),
        makeTool('reschedule_appointment', 'Move an appointment to a new time', { appointmentId: {type:'string'}, newTime: {type:'string'} }, ['appointmentId', 'newTime']),
        makeTool('collect_booking_deposit', 'Request a deposit before confirming slot', { appointmentId: {type:'string'}, amount: {type:'number'} }, ['appointmentId', 'amount']),
        makeTool('sync_fresha_calendar', 'Integrate with Fresha booking CRM', { apiKey: {type:'string'} }, ['apiKey']),
        makeTool('sync_calendly', 'Integrate with Calendly', { accessToken: {type:'string'} }, ['accessToken'])
    ]
};

let indexExport = '';
let allToolsArr = [];

for (const [domainName, tools] of Object.entries(domains)) {
    const fileContent = 'export const ' + domainName + ' = ' + JSON.stringify(tools, null, 2) + ';\n';
    fs.writeFileSync(path.join(outDir, domainName + '.ts'), fileContent, 'utf8');
    indexExport += 'export { ' + domainName + ' } from "./' + domainName + '.js";\n';
    
    allToolsArr.push('...' + domainName);
}

indexExport += '\nimport { ' + Object.keys(domains).join(', ') + ' } from "./index.js";\n';
indexExport += '\nexport const allBiblioTools = [\n  ' + allToolsArr.join(',\n  ') + '\n];\n';

fs.writeFileSync(path.join(outDir, 'index.ts'), indexExport, 'utf8');

console.log("Successfully generated " + Object.keys(domains).length + " domain files containing 100+ tools.");
