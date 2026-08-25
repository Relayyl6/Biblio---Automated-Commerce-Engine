const fs = require('fs');
let code = fs.readFileSync('ace-whatsapp/core/ai-negotiator/src/tools/settingsTools.ts', 'utf8');

const regex = /update_store_hours: async \(merchantId: string, args: any\) => \{[\s\S]*?return \`Action \$\{'update_store_hours'\} processed successfully \(Ref: \$\{actionId\.split\('-'\)\[0\]\}\)\.\`;\n\s*\}/m;
const replacement = `update_store_hours: async (merchantId: string, args: { schedule: string }) => {
    const parsedSchedule = typeof args.schedule === 'string' ? JSON.parse(args.schedule) : args.schedule;
    const result = await sql\`
      UPDATE merchants 
      SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{storeHours}', \${JSON.stringify(parsedSchedule)}::jsonb) 
      WHERE id = \${merchantId} 
      RETURNING settings
    \`;
    return { success: true, updatedSettings: result[0].settings, message: "Store hours updated." };
  }`;

code = code.replace(regex, replacement);
fs.writeFileSync('ace-whatsapp/core/ai-negotiator/src/tools/settingsTools.ts', code, 'utf8');
