import { dataIntelligence } from "./data-intelligence/engine.js";

type LogLevel = "info" | "warn" | "error" | "debug";

export const logger = {
  log: (message: string, metadata?: any) => {
    console.log(message, metadata || "");
    routeToActivityPanel("info", message, metadata).catch(() => {});
  },
  warn: (message: string, metadata?: any) => {
    console.warn(message, metadata || "");
    routeToActivityPanel("warn", message, metadata).catch(() => {});
  },
  error: (message: string, metadata?: any) => {
    console.error(message, metadata || "");
    routeToActivityPanel("error", message, metadata).catch(() => {});
  },
  debug: (message: string, metadata?: any) => {
    console.debug(message, metadata || "");
  }
};

async function routeToActivityPanel(level: LogLevel, message: string, metadata?: any) {
  // If the log contains a merchantId, we can route it to their specific activity panel
  // via the audit log / data intelligence engine.
  const merchantId = metadata?.merchantId;
  
  if (merchantId) {
    try {
      await dataIntelligence.auditLog({
        service: "system-logger",
        merchantId,
        action: "system_log",
        metadata: { level, message, ...metadata }
      });
    } catch (err) {
      console.error("[Logger] Failed to write to activity panel:", err);
    }
  }
}
