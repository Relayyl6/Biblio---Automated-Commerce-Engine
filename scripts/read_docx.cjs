const fs = require('fs');
const xml = fs.readFileSync('biblo_extracted/word/document.xml', 'utf8');
const text = xml.replace(/<w:t[^>]*>/g, '@@START@@').replace(/<\/w:t>/g, '@@END@@');
const matches = [...text.matchAll(/@@START@@(.*?)@@END@@/g)];
const out = matches.map(m => m[1]).join('');
console.log(out.substring(0, 1000));
fs.writeFileSync('doc_content.txt', out);
