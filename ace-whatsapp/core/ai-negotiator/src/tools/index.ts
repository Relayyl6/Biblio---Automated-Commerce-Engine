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

import { inventoryTools, orderTools, crmTools, negotiationTools, financeTools, marketingTools, analyticsTools, settingsTools, integrationTools, bookingTools, adminTools } from "./index.js";

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
  ...adminTools
];
