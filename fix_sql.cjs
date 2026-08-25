const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/state-machine/src/orderStateMachine.ts', 'utf8');

const regex = /\/\/ It's a successful transition[\s\S]*?\\\;/g;
const replacement = `// It's a successful transition
    await sql\`
      UPDATE orders 
      SET state = \${result}, updated_at = NOW() 
      WHERE id = \${orderId}
    \`;`;

code = code.replace(regex, replacement);
fs.writeFileSync('ace-whatsapp/core/state-machine/src/orderStateMachine.ts', code, 'utf8');
