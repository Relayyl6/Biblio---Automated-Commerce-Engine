const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/ai-negotiator/src/tools/settingsTools.ts', 'utf8');

const regex = /export const settingsTools = \[\s*\{\s*"type": "function",\s*"function": \{\s*"name": "update_store_hours"[\s\S]*?\s*\}\s*\s*\},\n/m;
const replacement = `export const settingsTools = [
  {
    "type": "function",
    "function": {
      "name": "update_store_hours",
      "description": "Set specific business availability times. You can map specific days (monday, tuesday, etc) to their open/close times or 'closed' status. For example: { monday: { open: '09:00', close: '17:00' }, tuesday: 'closed' }",
      "parameters": {
        "type": "object",
        "properties": {
          "schedule": {
            "type": "string",
            "description": "A JSON string representing the daily schedule. Keys are lowercase day names. Values are { 'open': 'HH:MM', 'close': 'HH:MM' } or 'closed'."
          }
        },
        "required": ["schedule"]
      }
    }
  },
`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('ace-whatsapp/core/ai-negotiator/src/tools/settingsTools.ts', code, 'utf8');
    console.log("Replaced successfully via regex");
} else {
    console.log("Regex not found. File may already be updated.");
}
