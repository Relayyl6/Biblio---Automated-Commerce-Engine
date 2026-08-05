// core/comms-router/src/index.ts
//
// Omni-Channel Shared Inbox & Communication Router
// Exports inbound buffering, sliding debounce worker, outbound messaging adapters,
// and the Vendor Communiqué engine.

export {
  enqueueInboundMessage,
  turnQueue,
  turnWorker,
} from "./debounce.js";

export {
  sendCustomerMessage,
  type SendClass,
} from "./outbound.js";

export {
  vendorCommunique,
  VendorCommuniqueEngine,
  type EscalationContext,
} from "./vendorCommunique.js";

export {
  sendWhatsAppMessage,
  EscalationPriority,
} from "./whatsapp.js";
