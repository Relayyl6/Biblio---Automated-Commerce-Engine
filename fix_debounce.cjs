const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/comms-router/src/debounce.ts', 'utf8');

if (!code.includes('import { logger }')) {
  code = code.replace(
    /import \{ Queue, Worker, Job \} from "bullmq";/,
    `import { Queue, Worker, Job } from "bullmq";\nimport { logger } from "@ace/shared/logger.js";`
  );
}

// Remove the wrongly placed event listeners
code = code.replace(/biblioWorker\.on\(\"error\".*\nbiblioWorker\.on\(\"failed\".*\n\nturnWorker\.on\(\"error\".*\nturnWorker\.on\(\"failed\".*\n\n/g, '');

// Append them at the end of the file
if (!code.includes('biblioWorker.on("error"')) {
  code += `\nbiblioWorker.on("error", (err) => logger.error("[BiblioWorker] Redis error:", err));\nbiblioWorker.on("failed", (job, err) => logger.error(\`[BiblioWorker] Job \${job?.id} failed:\`, err));\n\nturnWorker.on("error", (err) => logger.error("[TurnWorker] Redis error:", err));\nturnWorker.on("failed", (job, err) => logger.error(\`[TurnWorker] Job \${job?.id} failed:\`, err));\n`;
}

fs.writeFileSync('ace-whatsapp/core/comms-router/src/debounce.ts', code, 'utf8');
