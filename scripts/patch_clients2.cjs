const fs = require('fs');
let file = 'shared/src/clients.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "import Redis from 'ioredis';",
  "import Redis from 'ioredis';\n// @ts-ignore\nimport RedisMock from 'ioredis-mock';"
);

content = content.replace(
  "export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');",
  "export const redis = process.env.TEST_MODE === 'true' ? new (RedisMock as any)() : new Redis(process.env.REDIS_URL || 'redis://localhost:6379');"
);

content = content.replace(
  "export const redis = new Redis(process.env.REDIS_URL);",
  "export const redis = process.env.TEST_MODE === 'true' ? new (RedisMock as any)() : new Redis(process.env.REDIS_URL);"
);

fs.writeFileSync(file, content);
console.log('Patched clients.ts');
