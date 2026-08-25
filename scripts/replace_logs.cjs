const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/USER/Documents/Biblio';

// Regex to find console.log/warn/error/debug
const consoleRegex = /console\.(log|warn|error|debug)\b/g;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.match(consoleRegex)) return;

    content = content.replace(/console\.log/g, 'logger.log');
    content = content.replace(/console\.warn/g, 'logger.warn');
    content = content.replace(/console\.error/g, 'logger.error');
    content = content.replace(/console\.debug/g, 'logger.debug');
    
    if (!content.includes('import { logger }')) {
        let importPath = '@ace/shared/logger.ts';
        if (filePath.includes('ace-platform')) {
            // Adjust if ace-platform uses a different alias or relative path
            importPath = '@ace/shared/logger.js'; // fallback
        } else {
            importPath = '@ace/shared/logger.js';
        }
        content = 'import { logger } from "' + importPath + '";\n' + content;
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated: " + filePath);
}

const ignoreDirs = ['node_modules', 'dist', 'apps', 'scratch', '.git', '.vscode', '.next', 'build'];

function walkDir(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (err) {
        return;
    }
    for (const file of files) {
        if (ignoreDirs.includes(file)) continue;
        
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') && !fullPath.includes('.d.ts')) {
            // Only process .ts files that are not the logger itself
            if (!fullPath.endsWith('logger.ts')) {
                processFile(fullPath);
            }
        }
    }
}

walkDir(baseDir);
