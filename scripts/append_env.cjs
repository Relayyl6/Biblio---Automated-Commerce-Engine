const fs = require('fs');
let content = fs.readFileSync('.env', 'utf8');

if (!content.includes('PAYSTACK_SECRET_KEY=')) {
  content += '\nPAYSTACK_SECRET_KEY=sk_test_your_key_here\n';
}
if (!content.includes('KWIK_API_KEY=')) {
  content += 'KWIK_API_KEY=your_kwik_key\n';
}
if (!content.includes('SENDBOX_API_KEY=')) {
  content += 'SENDBOX_API_KEY=your_sendbox_key\n';
}

fs.writeFileSync('.env', content);
console.log('Appended missing API keys to .env');
