const fs = require('fs');
let file = 'validation_suite.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /INSERT INTO merchants \(id, name, contact_phone\)\s*VALUES \(\\$\{merchantId\}\, 'Validation Test Store', \\$\{merchantPhone\}\\)/,
  "INSERT INTO merchants (id, name, contact_phone, phone_number_id)\n    VALUES (${merchantId}, 'Validation Test Store', ${merchantPhone}, ${merchantPhone})"
);
fs.writeFileSync(file, content);
console.log('Fixed phone_number_id.');
