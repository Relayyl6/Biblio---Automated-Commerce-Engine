const fs = require('fs');
const file = 'ace-whatsapp/core/ai-negotiator/src/routerConfig.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { inventoryTools, orderTools, crmTools, negotiationTools, financeTools, marketingTools, analyticsTools, settingsTools, integrationTools, bookingTools } from "./tools/index.js";',
  'import { inventoryTools, orderTools, crmTools, negotiationTools, financeTools, marketingTools, analyticsTools, settingsTools, integrationTools, bookingTools, adminTools } from "./tools/index.js";'
);

content = content.replace(
  '  {\n    type: "function" as const,\n    function: {\n      name: "route_to_booking",',
  '  {\n    type: "function" as const,\n    function: {\n      name: "route_to_admin",\n      description: "Route to the Admin Manager for viewing and approving automated system drafts (like Restock POs, Win-back discounts, Tone guides)."\n    }\n  },\n  {\n    type: "function" as const,\n    function: {\n      name: "route_to_booking",'
);

content = content.replace(
  '  route_to_booking: bookingTools,',
  '  route_to_admin: adminTools,\n  route_to_booking: bookingTools,'
);

content = content.replace(
  '  route_to_booking: "You are the ACE Booking Sub-Agent.',
  '  route_to_admin: "You are the ACE Admin Manager Sub-Agent. Your job is to fetch pending system drafts (restocks, discounts, tone changes) and approve/reject them on the merchant\'s behalf.",\n  route_to_booking: "You are the ACE Booking Sub-Agent.'
);

fs.writeFileSync(file, content);
console.log('Updated routerConfig.ts');
