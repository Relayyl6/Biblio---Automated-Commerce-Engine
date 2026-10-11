const fs = require('fs');
let file = 'validation_suite.ts';
let content = fs.readFileSync(file, 'utf8');

const newFunc = \sync function setupTestMerchant() {
  const merchantId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const productId = crypto.randomUUID();

  // Create Merchant
  await sql\\\
    INSERT INTO merchants (id, name, contact_phone, phone_number_id)
    VALUES (\$\\{merchantId\\}, 'Validation Test Store', \$\\{merchantPhone\\}, \$\\{merchantPhone\\})
    ON CONFLICT (id) DO UPDATE SET name = 'Validation Test Store'
    RETURNING id
  \\\;

  // Create Customer
  await sql\\\
    INSERT INTO customers (id, phone, name)
    VALUES (\$\\{customerId\\}, \$\\{customerPhone\\}, 'Test Customer')
    ON CONFLICT (phone) DO UPDATE SET name = 'Test Customer'
    RETURNING id
  \\\;

  await sql\\\
    INSERT INTO customer_merchant_links (customer_id, merchant_id)
    VALUES (\$\\{customerId\\}, \$\\{merchantId\\})
    ON CONFLICT DO NOTHING
  \\\;

  // Create Product
  await sql\\\
    INSERT INTO products (id, merchant_id, name, price, stock_quantity, reorder_threshold)
    VALUES (\$\\{productId\\}, \$\\{merchantId\\}, 'Test Ankara Fabric', 10000, 10, 5)
    ON CONFLICT DO NOTHING
  \\\;

  // Enable Retention rules
  await sql\\\
    INSERT INTO merchant_pricing_rules (merchant_id, max_discount_percent, winback_discounts_enabled)
    VALUES (\$\\{merchantId\\}, 15, true)
    ON CONFLICT (merchant_id) DO UPDATE SET winback_discounts_enabled = true
  \\\;

  return { merchantId, customerId, productId };
}\;

content = content.replace(/async function setupTestMerchant\(\) \{[\s\S]*?return \{ merchantId, customerId, productId \};\n\}/, newFunc);
fs.writeFileSync(file, content);
console.log('Fixed setupTestMerchant.');
