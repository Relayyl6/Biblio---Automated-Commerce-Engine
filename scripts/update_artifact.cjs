const fs = require('fs');
let file = 'C:/Users/USER/.gemini/antigravity/brain/20f86579-1983-48e8-a0ea-6ef71db5985d/merchant_app_requirements.md';
let content = fs.readFileSync(file, 'utf8');
content += "\n\n## 5. Conversational Admin Control (Biblio Agent)\nWhile the React Native app provides a visual Command Center, the merchant can also execute **full administrative control** directly through WhatsApp by chatting with the Biblio Agent.\n*   **Approval Commands:** The merchant can approve/reject drafts (e.g., \"Approve my pending restock drafts\" or \"Reject the discount for John\").\n*   **Configurability:** The merchant can dynamically adjust system settings via chat (e.g., \"Enable win-back discounts and set the max to 10%\" or \"Change the reorder threshold for Ankara Fabric to 20\"). The AI maps these intents directly to the Postgres configuration tables.\n";
fs.writeFileSync(file, content);
console.log('Artifact updated.');
