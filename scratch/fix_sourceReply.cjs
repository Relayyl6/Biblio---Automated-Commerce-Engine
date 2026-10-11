const fs = require('fs');
let f = 'C:/Users/USER/Documents/Biblio/ace-whatsapp/core/comms-router/src/sourceReplyHandler.ts';
let code = fs.readFileSync(f, 'utf8');

code = code.replace(/sendCustomerMessage\(merchantPhone,\s*\{\s*text:\s*([\s\S]*?)\s*\},\s*null,\s*msg\.toPhoneNumberId!\)/g, 'sendCustomerMessage({ toPhone: merchantPhone, text:  }, undefined, msg.toPhoneNumberId!)');

fs.writeFileSync(f, code, 'utf8');
