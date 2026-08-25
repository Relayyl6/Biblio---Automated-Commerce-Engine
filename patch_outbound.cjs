const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/comms-router/src/outbound.ts', 'utf8');

code = code.replace(/toPhone/g, 'targetPhone');
code = code.replace(/msg\.targetPhone/g, 'msg.toPhone');
code = code.replace(/console\.log\(`\\n\?\? \[WHATSAPP OUTBOUND to \$\{msg\.toPhone \?\? msg\.toSenderId\}\]: \$\{msg\.text\}\\n`\);/g,
  'const targetPhone = msg.toPhone ?? msg.toSenderId ?? "";\n  console.log(`\\n💬 [WHATSAPP OUTBOUND to ${targetPhone}]: ${msg.text}\\n`);'
);
// wait, the first replace /toPhone/g replaced msg.toPhone with msg.targetPhone, so the second one reverted it to msg.toPhone.
// but what about the console.log line which had msg.toPhone?

fs.writeFileSync('ace-whatsapp/core/comms-router/src/outbound.ts', code, 'utf8');
