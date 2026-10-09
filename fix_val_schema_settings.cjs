const fs = require('fs');
let file = 'validation_suite.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/contact_phone, settings/g, 'contact_phone');
content = content.replace(/, '\{\}'/g, '');
fs.writeFileSync(file, content);
console.log('Fixed settings schema.');
