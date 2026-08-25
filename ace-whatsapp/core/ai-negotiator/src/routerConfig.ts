import { inventoryTools, orderTools, crmTools, negotiationTools, financeTools, marketingTools, analyticsTools, settingsTools, integrationTools, bookingTools } from "./tools/index.js";

// The primary Router Agent tools
export const routerTools = [
  {
    type: "function" as const,
    function: {
      name: "route_to_inventory",
      description: "Route to the Inventory Manager for tasks like adding products, updating stock, categorizing, or syncing catalogs.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_orders",
      description: "Route to the Order Manager for tasks like shipping, canceling, splitting, or tracking orders.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_crm",
      description: "Route to the CRM Manager for tasks like customer profiles, tags, blocking, or CRM sync (HubSpot/Salesforce).",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_negotiation",
      description: "Route to the Sales & Negotiation Manager for tasks like active escalations, floor prices, discount codes, and quotes.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_finance",
      description: "Route to the Finance Manager for revenue, escrow, payouts, invoicing, refunds, and tax/accounting sync.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_marketing",
      description: "Route to the Marketing Manager for WhatsApp Status automation, marketing copy, flash sales, and abandoned carts.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_analytics",
      description: "Route to the Analytics Engine for sales forecasting, peak hours, popular products, and sentiment analysis.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_settings",
      description: "Route to the Store Configurator for store hours, policies, staff permissions, and vacation mode.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_integrations",
      description: "Route to the Webhooks & Integrations Manager for third-party sync like Mailchimp, Slack, Zapier, and Google Sheets.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "route_to_booking",
      description: "Route to the Booking Manager for adding/configuring services, service appointments, calendar availability, deposits, and Fresha/Calendly sync.",
    }
  },
  {
    type: "function" as const,
    function: {
      name: "direct_reply",
      description: "If the user is just saying hello, asking a general question, or saying thanks, reply directly without routing.",
      parameters: {
        type: "object",
        properties: {
          reply: { type: "string", description: "Your direct response to the vendor" }
        },
        required: ["reply"]
      }
    }
  }
];

// Map router tool names to the actual sub-agent toolsets
export const subAgentToolsets: Record<string, any[]> = {
  route_to_inventory: inventoryTools,
  route_to_orders: orderTools,
  route_to_crm: crmTools,
  route_to_negotiation: negotiationTools,
  route_to_finance: financeTools,
  route_to_marketing: marketingTools,
  route_to_analytics: analyticsTools,
  route_to_settings: settingsTools,
  route_to_integrations: integrationTools,
  route_to_booking: bookingTools,
};

// Map router tool names to specific system prompts for the sub-agents
export const subAgentPrompts: Record<string, string> = {
  route_to_inventory: "You are the ACE Inventory Manager Sub-Agent. Your job is to manage the vendor's catalog, stock, and pricing.",
  route_to_orders: "You are the ACE Order Manager Sub-Agent. Your job is to handle fulfillment, logistics, shipping, and cancellations.",
  route_to_crm: "You are the ACE CRM Sub-Agent. Your job is to manage customer relationships, tags, segmentation, and CRM synchronization.",
  route_to_negotiation: "You are the ACE Sales & Negotiation Sub-Agent. Your job is to step into active customer negotiations, set floor prices, and handle quotes.",
  route_to_finance: "You are the ACE Finance Sub-Agent. Your job is to handle revenue analytics, payouts, invoices, refunds, and accounting integrations.",
  route_to_marketing: "You are the ACE Marketing Sub-Agent. Your job is to blast items to WhatsApp status, write copy, and manage flash sales.",
  route_to_analytics: "You are the ACE Data Intelligence Sub-Agent. Your job is to forecast sales, analyze peak hours, and provide strategic business insights.",
  route_to_settings: "You are the ACE Store Configurator Sub-Agent. Your job is to update store policies, hours, staff permissions, and general configurations.",
  route_to_integrations: "You are the ACE Integrations Sub-Agent. Your job is to manage custom webhooks, API keys, and third-party platform connections.",
  route_to_booking: "You are the ACE Booking Sub-Agent. Your job is to create and manage the vendor's catalog of services, handle service appointments, calendar availability, and integrations with scheduling tools like Fresha."
};
