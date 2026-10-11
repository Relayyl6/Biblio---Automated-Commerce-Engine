const fs = require('fs');

let f = 'C:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/tools.ts';
let code = fs.readFileSync(f, 'utf8');
code = code.replace(/sendCustomerMessage\(\s*source\.contact!,\s*\{\s*text:\s*querySent\s*\},[\s\S]*?null,[\s\S]*?ctx\.merchantId\s*\);/g, 'sendCustomerMessage({ toPhone: source.contact!, text: querySent }, undefined, ctx.merchantId);');
fs.writeFileSync(f, code, 'utf8');

f = 'C:/Users/USER/Documents/Biblio/ace-whatsapp/core/comms-router/src/sourceReplyHandler.ts';
code = fs.readFileSync(f, 'utf8');
code = code.replace(/sendCustomerMessage\(\s*merchantPhone,\s*\{\s*text:\s*(.*?)\s*\},\s*null,\s*merchantId\s*\)/g, 'sendCustomerMessage({ toPhone: merchantPhone, text: $1 }, undefined, merchantId)');
fs.writeFileSync(f, code, 'utf8');
