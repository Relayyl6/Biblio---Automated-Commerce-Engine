const fs = require('fs');
let code = fs.readFileSync('simulate.ts', 'utf8');

const regex = /global\.fetch = async \(url\) => \{[\s\S]*?return \{ ok: true, status: 200, text: async \(\) => "\{\}" \} as any;\n\s*\};/;
const replacement = `const originalFetch = global.fetch;
global.fetch = async (url, ...args) => {
  if (url.toString().includes("groq.com")) {
    return originalFetch(url, ...args);
  }
  logger.log(\`[Mocked fetch] Called with \${url.toString()}\`);
  return { 
    ok: true, 
    status: 200, 
    headers: new Headers(), // Added Headers to fix groq SDK crash if it somehow hits this
    text: async () => "{}" 
  } as any;
};`;

code = code.replace(regex, replacement);
fs.writeFileSync('simulate.ts', code, 'utf8');
