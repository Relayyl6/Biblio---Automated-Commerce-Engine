const fs = require('fs');
let file = 'validation_suite.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/business_name/g, 'name');
fs.writeFileSync(file, content);
console.log('Fixed schema.');
