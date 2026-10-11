const fs = require('fs');
let content = fs.readFileSync('src/index.ts', 'utf8');

const endpoints = content.split('// --- CHAT ENDPOINTS ---');
if (endpoints.length > 1) {
  const rest = endpoints[1];
  const newContent = content.substring(0, content.indexOf('// --- CHAT ENDPOINTS ---'));
  
  // Find where app.listen is in newContent
  const listenStr = "const port = Number(process.env.MERCHANT_API_PORT ?? 3004);";
  const finalContent = newContent.replace(listenStr, rest + "\n" + listenStr);
  
  fs.writeFileSync('src/index.ts', finalContent);
}
