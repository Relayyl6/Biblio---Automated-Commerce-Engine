const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs");
const path = require("path");

const project = new Project();
project.addSourceFilesAtPaths("ace-whatsapp/core/ai-negotiator/src/**/*.ts");

const toolHandlersFile = project.getSourceFileOrThrow("ace-whatsapp/core/ai-negotiator/src/toolHandlers.ts");
const toolHandlersDecl = toolHandlersFile.getVariableDeclarationOrThrow("toolHandlers");
const initializer = toolHandlersDecl.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
const properties = initializer.getProperties();

const handlerMap = new Map();
for (const prop of properties) {
    if (prop.isKind(SyntaxKind.PropertyAssignment)) {
        handlerMap.set(prop.getName(), prop.getInitializer().getText());
    }
}

const toolFiles = project.getSourceFiles().filter(f => f.getFilePath().includes("src/tools/") && !f.getFilePath().endsWith("index.ts"));

const importedHandlers = [];

for (const file of toolFiles) {
    // Find the exported array (e.g., inventoryTools)
    const exportDecl = file.getVariableDeclarations().find(d => d.getName().endsWith("Tools"));
    if (!exportDecl) continue;
    
    const arrayLit = exportDecl.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
    if (!arrayLit) continue;

    const toolNames = [];
    for (const elem of arrayLit.getElements()) {
        if (elem.isKind(SyntaxKind.ObjectLiteralExpression)) {
            const funcProp = elem.getProperty("function");
            if (funcProp && funcProp.isKind(SyntaxKind.PropertyAssignment)) {
                const funcObj = funcProp.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
                if (funcObj) {
                    const nameProp = funcObj.getProperty("name");
                    if (nameProp && nameProp.isKind(SyntaxKind.PropertyAssignment)) {
                        const name = nameProp.getInitializer().getText().replace(/['"]/g, '');
                        toolNames.push(name);
                    }
                }
            }
        }
    }

    const domainName = exportDecl.getName().replace("Tools", "");
    const handlersObjectName = `${domainName}Handlers`;
    importedHandlers.push(handlersObjectName);

    let handlersCode = `\n\nexport const ${handlersObjectName}: Record<string, (merchantId: string, args: any) => Promise<any>> = {\n`;
    for (const name of toolNames) {
        if (handlerMap.has(name)) {
            handlersCode += `  ${name}: ${handlerMap.get(name)},\n`;
        }
    }
    handlersCode += `};\n`;

    // Add necessary imports to the file
    const imports = `import { sql, redis } from "@ace/shared/clients";\nimport { logger } from "@ace/shared/logger.js";\nimport crypto from "crypto";\n\n`;
    const currentCode = file.getFullText();
    file.replaceWithText(imports + currentCode + handlersCode);
}

// Rewrite toolHandlers.ts
let newToolHandlersCode = `import { logger } from "@ace/shared/logger.js";\nimport crypto from "crypto";\n`;

for (const file of toolFiles) {
    const domainName = file.getBaseNameWithoutExtension().replace("Tools", "");
    newToolHandlersCode += `import { ${domainName}Handlers } from "./tools/${file.getBaseNameWithoutExtension()}.js";\n`;
}

newToolHandlersCode += `\n// Generic Third Party Request util
async function makeThirdPartyRequest(integration: string, endpoint: string, payload: any, headers?: any): Promise<any> {
    await logger.log(\`[ThirdParty:\${integration}] Request to \${endpoint}\`, payload);
    return { success: true, ref: crypto.randomUUID(), timestamp: Date.now(), eventId: "mock-event-id", slots: [], ok: true };
}

export const toolHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
`;

for (const handlerName of importedHandlers) {
    newToolHandlersCode += `  ...${handlerName},\n`;
}
newToolHandlersCode += `};\n`;

toolHandlersFile.replaceWithText(newToolHandlersCode);

project.saveSync();
console.log("Refactoring complete.");
