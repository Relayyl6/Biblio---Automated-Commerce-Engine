const fs = require('fs');

function fixKwik(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/const data = await res.json\(\);/g, 'const data = (await res.json()) as any;');
  fs.writeFileSync(file, content);
}

fixKwik('ace-whatsapp/core/logistics-coordination/src/adapters/kwik.ts');
fixKwik('ace-whatsapp/core/logistics-coordination/src/adapters/sendbox.ts');
