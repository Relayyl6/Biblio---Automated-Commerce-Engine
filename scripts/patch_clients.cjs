const fs = require('fs');
let file = 'ace-whatsapp/shared/src/clients.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import Redis from 'ioredis';",
  "import Redis from 'ioredis';\nimport RedisMock from 'ioredis-mock';"
);

content = content.replace(
  "export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');",
  "export const redis = process.env.TEST_MODE ? new RedisMock() : new Redis(process.env.REDIS_URL || 'redis://localhost:6379');"
);

// also catch the alternate form if it's there
content = content.replace(
  "export const redis = new Redis(process.env.REDIS_URL);",
  "export const redis = process.env.TEST_MODE ? new RedisMock() : new Redis(process.env.REDIS_URL);"
);

fs.writeFileSync(file, content);
console.log('Patched clients.ts for TEST_MODE');
