const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs");

const project = new Project();
project.addSourceFilesAtPaths("ace-whatsapp/core/ai-negotiator/src/**/*.ts");

const toolHandlersFile = project.getSourceFileOrThrow("ace-whatsapp/core/ai-negotiator/src/toolHandlers.ts");
const toolFiles = project.getSourceFiles().filter(f => f.getFilePath().includes("src/tools/") && !f.getFilePath().endsWith("index.ts"));

// We need the original handlers. Since we wiped them from toolHandlers.ts, we must git checkout toolHandlers.ts first!
