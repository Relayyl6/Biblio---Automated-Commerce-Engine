const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/USER/Documents/Biblio/ace-whatsapp/core';

// Regex to find console.log/warn/error
const consoleRegex = /console\.(log|warn|error)\b/g;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // If it doesn't have console., skip
    if (!content.match(consoleRegex)) return;

    // Replace all instances of console.log, console.warn, console.error
    content = content.replace(/console\.log/g, 'logger.log');
    content = content.replace(/console\.warn/g, 'logger.warn');
    content = content.replace(/console\.error/g, 'logger.error');
    
    // Add import statement at the top if not present
    if (!content.includes('import { logger }')) {
        // Find the first line after imports or just put it at the very top
        content = 'import { logger } from "@ace/shared/logger.js";\n' + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated: " + filePath);
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

walkDir(baseDir);
