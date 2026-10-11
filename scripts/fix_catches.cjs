const fs = require('fs');

function fix(filePath, replacements) {
  let code = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (code.includes(from)) {
      code = code.replace(from, to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, code, 'utf8');
    console.log('Fixed: ' + filePath);
  } else {
    console.log('No match (may already be fixed): ' + filePath);
  }
}

// agentLoop.ts line 355 — swallowed catch on a non-critical state save
fix('ace-whatsapp/core/ai-negotiator/src/agentLoop.ts', [
  ['}).catch(() => {});',
   '}).catch(err => logger.error({ err }, "[AgentLoop] Non-critical background state save failed"));']
]);

// tools.ts lines 670, 829
fix('ace-whatsapp/core/ai-negotiator/src/tools.ts', [
  ['    }).catch(() => {});',
   '    }).catch(err => logger.error({ err }, "[Tools] Non-critical telemetry emit failed"));']
]);

// inventoryParser.ts line 360
fix('ace-whatsapp/core/baileys-gateway/src/inventoryParser.ts', [
  ['  }).catch(() => {});',
   '  }).catch(err => logger.error({ err }, "[InventoryParser] Non-critical status notification failed"));']
]);

// messageClassifier.ts line 156
fix('ace-whatsapp/core/baileys-gateway/src/messageClassifier.ts', [
  ['    .catch(() => {});',
   '    .catch(err => logger.error({ err }, "[MessageClassifier] Non-critical audit log failed"));']
]);

// debounce.ts line 154
fix('ace-whatsapp/core/comms-router/src/debounce.ts', [
  ['  `.catch(() => {});',
   '  `.catch(err => logger.error({ err }, "[Debounce] Non-critical telemetry emit failed"));']
]);

// logistics-coordination line 143
fix('ace-whatsapp/core/logistics-coordination/src/index.ts', [
  ['      ).catch(() => {});',
   '      ).catch(err => logger.error({ err }, "[Logistics] Non-critical telemetry emit failed"));']
]);

// sessionManager.ts — multiple swallowed catches
// These are intentional "don't crash the handler" patterns — upgrade to warn-level logs
const smPath = 'ace-whatsapp/core/baileys-gateway/src/sessionManager.ts';
let smCode = fs.readFileSync(smPath, 'utf8');
// Replace all empty catches with warn-logged ones
smCode = smCode.replace(/\.catch\(\(\) => \{\}\); \/\/ Don't crash the handler if DB is briefly unavailable/g,
  '.catch(err => logger.warn({ err }, "[SessionManager] Non-critical DB update failed, continuing"));');
smCode = smCode.replace(/await alertVendorReprovision\(vendorId\)\.catch\(\(\) => \{\}\);/g,
  'await alertVendorReprovision(vendorId).catch(err => logger.warn({ err, vendorId }, "[SessionManager] alertVendorReprovision failed"));');
// Generic empty catches in sessionManager
const emptyCount = (smCode.match(/\.catch\(\(\) => \{\}\)/g) || []).length;
if (emptyCount > 0) {
  smCode = smCode.replace(/\.catch\(\(\) => \{\}\)/g, '.catch(err => logger.warn({ err }, "[SessionManager] Non-critical operation failed"))');
  console.log(`Fixed ${emptyCount} empty catches in sessionManager.ts`);
}
fs.writeFileSync(smPath, smCode, 'utf8');
console.log('Fixed: ' + smPath);

console.log('\nAll swallowed catches fixed!');
