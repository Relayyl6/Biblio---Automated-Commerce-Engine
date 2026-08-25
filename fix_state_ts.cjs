const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/state-machine/src/orderStateMachine.ts', 'utf8');

code = code.replace(/SET state = \$\{result\},/, 'SET state = ${sql.json(result)},');
code = code.replace(/event\.type === "ORDER_COMPLETED"/, 'event.type as string === "ORDER_COMPLETED"');
code = code.replace(/event\.type === "MARK_SHIPPED"/, 'event.type as string === "MARK_SHIPPED"');
fs.writeFileSync('ace-whatsapp/core/state-machine/src/orderStateMachine.ts', code, 'utf8');
