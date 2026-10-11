const fs = require('fs');
let content = fs.readFileSync('validation_suite.ts', 'utf8');
content = content.replace(/.\/ace-whatsapp\/shared\/src\/clients.js/g, './shared/src/clients.js');
content = content.replace(/.\/ace-whatsapp\/shared\/src\/logger.js/g, './shared/src/logger.js');
fs.writeFileSync('validation_suite.ts', content);
console.log('Fixed paths.');
