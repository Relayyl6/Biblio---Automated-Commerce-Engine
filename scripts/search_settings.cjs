const fs = require('fs');
const text = fs.readFileSync('doc_content.txt', 'utf8');

// Find occurrences of 'setting' or 'admin' or 'merchant app'
const lines = text.split(/(?<=\.)/g);
lines.forEach(line => {
  if (line.toLowerCase().includes('setting') || line.toLowerCase().includes('merchant app')) {
    console.log(line);
  }
});
