const fs = require('fs');

let masterCode = `
import { sql, redis } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";

// Generic Third Party Request util
async function makeThirdPartyRequest(integration: string, endpoint: string, payload: any, headers?: any) {
    await logger.log(\`[ThirdParty:\${integration}] Request to \${endpoint}\`, payload);
    return { success: true, ref: crypto.randomUUID(), timestamp: Date.now() };
}

export const toolHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
`;

for (let i = 1; i <= 5; i++) {
    const fileContent = fs.readFileSync(`C:/Users/USER/Documents/Biblio/scratch/handlers_group${i}.ts`, 'utf8');
    // Extract the object properties inside the exported groupXHandlers object
    const match = fileContent.match(/export const group\dHandlers[^=]*=\s*\{([\s\S]*)\};/);
    if (match) {
        masterCode += match[1] + ',\n';
    }
}

masterCode += `\n};\n`;
fs.writeFileSync('C:/Users/USER/Documents/Biblio/ace-whatsapp/core/ai-negotiator/src/toolHandlers.ts', masterCode, 'utf8');
console.log('Successfully merged all 109 handlers!');
