const fs = require('fs');

// 1. Patch merchant-api/src/index.ts
let merchantApi = fs.readFileSync('ace-whatsapp/core/merchant-api/src/index.ts', 'utf8');

// Add imports if missing
if (!merchantApi.includes('@fastify/rate-limit')) {
  merchantApi = merchantApi.replace(
    /import cors from "@fastify\/cors";/,
    'import cors from "@fastify/cors";\nimport rateLimit from "@fastify/rate-limit";'
  );
  
  merchantApi = merchantApi.replace(
    /await app\.register\(cors, \{[^\}]+\}\);/,
    `await app.register(cors, {
    origin: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173").split(","),
    credentials: true,
  });\n\n  await app.register(rateLimit, {\n    max: 100,\n    timeWindow: '1 minute'\n  });\n\n  app.setNotFoundHandler((request, reply) => {\n    reply.code(404).send({ error: "Not Found", message: \`Route \${request.method}:\${request.url} does not exist\` });\n  });`
  );
  
  merchantApi = merchantApi.replace(
    /app\.listen\(\{ port \}\);[\s\S]*?logger\.log\(`\[MerchantAPI\] Listening on port \$\{port\}`\);/,
    `await app.listen({ port });\n  logger.log(\`[MerchantAPI] Listening on port \${port}\`);\n\n  const signals = ['SIGINT', 'SIGTERM'];\n  signals.forEach((signal) => {\n    process.on(signal, async () => {\n      logger.log(\`\${signal} received. Shutting down gracefully...\`);\n      try {\n        await app.close();\n        process.exit(0);\n      } catch (err) {\n        logger.error("Error during shutdown", err);\n        process.exit(1);\n      }\n    });\n  });`
  );
  
  fs.writeFileSync('ace-whatsapp/core/merchant-api/src/index.ts', merchantApi, 'utf8');
}

// 2. Patch baileys-gateway/src/index.ts
let baileys = fs.readFileSync('ace-whatsapp/core/baileys-gateway/src/index.ts', 'utf8');

if (!baileys.includes('@fastify/rate-limit')) {
  baileys = baileys.replace(
    /import cors from "@fastify\/cors";/,
    'import cors from "@fastify/cors";\nimport rateLimit from "@fastify/rate-limit";'
  );
  
  baileys = baileys.replace(
    /await app\.register\(cors, \{ origin: "\*" \}\);/,
    `const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173").split(",").map(o => o.trim());
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
        cb(null, true);
      } else {
        cb(new Error(\`Origin \${origin} not allowed\`), false);
      }
    },
    credentials: true,
  });\n\n  await app.register(rateLimit, {\n    max: 100,\n    timeWindow: '1 minute'\n  });\n\n  app.setNotFoundHandler((request, reply) => {\n    reply.code(404).send({ error: "Not Found", message: \`Route \${request.method}:\${request.url} does not exist\` });\n  });`
  );
  
  baileys = baileys.replace(
    /await app\.listen\(\{ port \}\);[\s\S]*?logger\.log\(`\[Gateway\] HTTP admin API listening on port \$\{port\}`\);/,
    `await app.listen({ port });\n  logger.log(\`[Gateway] HTTP admin API listening on port \${port}\`);\n\n  const signals = ['SIGINT', 'SIGTERM'];\n  signals.forEach((signal) => {\n    process.on(signal, async () => {\n      logger.log(\`\${signal} received. Shutting down gracefully...\`);\n      try {\n        await app.close();\n        process.exit(0);\n      } catch (err) {\n        logger.error("Error during shutdown", err);\n        process.exit(1);\n      }\n    });\n  });`
  );
  
  fs.writeFileSync('ace-whatsapp/core/baileys-gateway/src/index.ts', baileys, 'utf8');
}
