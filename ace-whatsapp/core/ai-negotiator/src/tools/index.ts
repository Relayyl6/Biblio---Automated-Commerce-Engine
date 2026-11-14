export { inventoryTools } from "./inventoryTools.js";
export { orderTools } from "./orderTools.js";
export { crmTools } from "./crmTools.js";
export { negotiationTools } from "./negotiationTools.js";
export { financeTools } from "./financeTools.js";
export { marketingTools } from "./marketingTools.js";
export { analyticsTools } from "./analyticsTools.js";
export { settingsTools } from "./settingsTools.js";
export { integrationTools } from "./integrationTools.js";
export { bookingTools } from "./bookingTools.js";
export { adminTools } from "./adminTools.js";
export { autonomousTaskToolDefinitions, executeAutonomousTaskTool } from "./autonomousTaskTools.js";

import { inventoryTools } from "./inventoryTools.js";
import { orderTools } from "./orderTools.js";
import { crmTools } from "./crmTools.js";
import { negotiationTools } from "./negotiationTools.js";
import { financeTools } from "./financeTools.js";
import { marketingTools } from "./marketingTools.js";
import { analyticsTools } from "./analyticsTools.js";
import { settingsTools } from "./settingsTools.js";
import { integrationTools } from "./integrationTools.js";
import { bookingTools } from "./bookingTools.js";
import { adminTools } from "./adminTools.js";
import { autonomousTaskToolDefinitions } from "./autonomousTaskTools.js";

export const allBiblioTools = [
  ...inventoryTools,
  ...orderTools,
  ...crmTools,
  ...negotiationTools,
  ...financeTools,
  ...marketingTools,
  ...analyticsTools,
  ...settingsTools,
  ...integrationTools,
  ...bookingTools,
  ...adminTools,
  ...autonomousTaskToolDefinitions,
];
