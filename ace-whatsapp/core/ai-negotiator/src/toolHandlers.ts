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
import { adminHandlers } from "./tools/adminTools.js";
import { executeAutonomousTaskTool } from "./tools/autonomousTaskTools.js";

const autonomousTaskHandlers: Record<string, (merchantId: string, args: any) => Promise<any>> = {
  schedule_background_monitoring_task: async (merchantId, args) => {
    return await executeAutonomousTaskTool('schedule_background_monitoring_task', args, { merchantId });
  },
  manage_background_tasks: async (merchantId, args) => {
    return await executeAutonomousTaskTool('manage_background_tasks', args, { merchantId });
  },
  real_time_research_and_facts: async (merchantId, args) => {
    return await executeAutonomousTaskTool('real_time_research_and_facts', args, { merchantId });
  },
  commercial_writing_and_editing: async (merchantId, args) => {
    return await executeAutonomousTaskTool('commercial_writing_and_editing', args, { merchantId });
  },
  catalog_visuals_and_staging: async (merchantId, args) => {
    return await executeAutonomousTaskTool('catalog_visuals_and_staging', args, { merchantId });
  },
  merchant_math_margins_and_code: async (merchantId, args) => {
    return await executeAutonomousTaskTool('merchant_math_margins_and_code', args, { merchantId });
  },
  planning_and_brainstorming: async (merchantId, args) => {
    return await executeAutonomousTaskTool('planning_and_brainstorming', args, { merchantId });
  },
};

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
  ...adminHandlers,
  ...autonomousTaskHandlers,
};
