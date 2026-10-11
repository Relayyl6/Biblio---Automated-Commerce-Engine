const fs = require('fs');

function replaceLogger(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/logger\.info\(/g, 'logger.log(');
  content = content.replace(/logger\.error\(\{([^}]*)\},\s*(['"\"].*?['"\"])\)/g, 'logger.error(\, {})');
  content = content.replace(/logger\.warn\(\{([^}]*)\},\s*(['"\"].*?['"\"])\)/g, 'logger.warn(\, {})');
  content = content.replace(/logger\.log\(\{([^}]*)\},\s*(['"\"].*?['"\"])\)/g, 'logger.log(\, {})');
  fs.writeFileSync(file, content);
}

replaceLogger('ace-whatsapp/core/event-orchestrator/src/flows/inventoryRestockFlow.ts');
replaceLogger('ace-whatsapp/core/event-orchestrator/src/flows/nightlyRetentionFlow.ts');
replaceLogger('ace-whatsapp/core/retention-engine/src/analyzer.ts');
replaceLogger('ace-whatsapp/core/retention-engine/src/discountGenerator.ts');
replaceLogger('ace-whatsapp/core/retention-engine/src/gate.ts');

console.log('Fixed logger usages.');
