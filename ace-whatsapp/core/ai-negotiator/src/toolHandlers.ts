import { logger } from "@ace/shared/logger.js";
import crypto from "crypto";
import { analyticsHandlers } from "./tools/analyticsTools.js";
import { bookingHandlers } from "./tools/bookingTools.js";
import { crmHandlers } from "./tools/crmTools.js";
import { financeHandlers } from "./tools/financeTools.js";
import { integrationHandlers } from "./tools/integrationTools.js";
import { inventoryHandlers } from "./tools/inventoryTools.js";
import { marketingHandlers } from "./tools/marketingTools.js";
import { negotiationHandlers } from "./tools/negotiationTools.js";
import { orderHandlers } from "./tools/orderTools.js";
import { settingsHandlers } from "./tools/settingsTools.js";

export const toolHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  ...analyticsHandlers,
  ...bookingHandlers,
  ...crmHandlers,
  ...financeHandlers,
  ...integrationHandlers,
  ...inventoryHandlers,
  ...marketingHandlers,
  ...negotiationHandlers,
  ...orderHandlers,
  ...settingsHandlers,
};
