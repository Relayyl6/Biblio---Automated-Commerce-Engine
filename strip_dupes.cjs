const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    const domainName = file.split('/').pop().replace("Tools.ts", "");
    const declString = `export const ${domainName}Handlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {`;
    
    let parts = content.split(declString);
    if (parts.length > 2) {
        // Keep everything before the first one, then the first one + its body
        let newContent = parts[0] + declString;
        let bodyAndRest = parts[1];
        let endIdx = bodyAndRest.indexOf('};\n');
        newContent += bodyAndRest.substring(0, endIdx + 3);
        fs.writeFileSync(file, newContent, 'utf8');
    }
}

fix('ace-whatsapp/core/ai-negotiator/src/tools/crmTools.ts');
fix('ace-whatsapp/core/ai-negotiator/src/tools/bookingTools.ts');
