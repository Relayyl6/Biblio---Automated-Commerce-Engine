const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');
content = content.replace('import { sql, jsonb } from "@ace/shared/clients";', 'import { sql, jsonb, redis } from "@ace/shared/clients";');
fs.writeFileSync('src/index.ts', content);
