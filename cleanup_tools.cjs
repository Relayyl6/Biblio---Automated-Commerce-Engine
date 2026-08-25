const fs = require('fs');
const glob = require('glob');

const files = glob.sync('ace-whatsapp/core/ai-negotiator/src/tools/*.ts', { ignore: 'ace-whatsapp/core/ai-negotiator/src/tools/index.ts' });

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Remove duplicate imports block at the top
    const importsBlock = `import { sql, redis } from "@ace/shared/clients";\nimport { logger } from "@ace/shared/logger.js";\nimport crypto from "crypto";\n\n`;
    while (content.indexOf(importsBlock) !== content.lastIndexOf(importsBlock)) {
        content = content.replace(importsBlock, '');
    }

    // Remove empty handlers export block (the one that didn't populate)
    const domainName = file.split('/').pop().replace("Tools.ts", "");
    const emptyHandlerRegex = new RegExp(`export const ${domainName}Handlers: Record<string, \\(merchantId: string, args: any\\) => Promise<any>> = \\{\\n\\};\\n`, 'g');
    content = content.replace(emptyHandlerRegex, '');

    fs.writeFileSync(file, content, 'utf8');
}
console.log("Cleanup done!");
