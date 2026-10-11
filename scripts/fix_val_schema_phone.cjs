const fs = require('fs');
let file = 'validation_suite.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/phone, settings/g, 'contact_phone, settings');
content = content.replace(/ON CONFLICT \(phone\)/g, 'ON CONFLICT (id)');
fs.writeFileSync(file, content);
console.log('Fixed phone schema.');
