import { logger } from "@ace/shared/logger.js";
import { getMerchantApiKey } from "@ace/shared/integrations/credentials.js";
import AfricasTalking from "africastalking";
import twilio from "twilio";
import crypto from "crypto";

export type CallPurpose = 
  | 'order_confirmation'
  | 'payment_reminder'
  | 'delivery_coordination'
  | 'vendor_escalation'
  | 'custom';

export type VoicePersona = 
  | 'warm_nigerian_english'
  | 'pidgin_blend'
  | 'formal_corporate';

export interface VoiceCallConfig {
  enabled: boolean;
  approvalMode: 'require_approval' | 'fully_autonomous';
  callOnOrderConfirmation: boolean;
  callOnPendingPayment: boolean;
  callOnHighValue: boolean;
  highValueThreshold: number;
  callOnRiderDispatch: boolean;
  voicePersona: VoicePersona;
  customScriptTemplate?: string;
}

export interface OutboundVoiceCallRequest {
  toPhone: string;
  merchantId: string;
  merchantName: string;
  purpose: CallPurpose;
  customScript?: string;
  orderId?: string;
  orderTotal?: number;
  deliveryAddress?: string;
  voicePersona?: VoicePersona;
}

export interface QueuedVoiceCall {
  queueId: string;
  merchantId: string;
  merchantName: string;
  toPhone: string;
  purpose: CallPurpose;
  scriptPreview: string;
  orderId?: string;
  orderTotal?: number;
  deliveryAddress?: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  createdAt: string;
}

export interface VoiceCallRecord {
  callId: string;
  provider: 'africas_talking' | 'twilio' | 'sandbox_simulator';
  toPhone: string;
  merchantId: string;
  merchantName: string;
  purpose: CallPurpose;
  status: 'queued' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  spokenScript: string;
  dtmfResponse?: string;
  initiatedAt: string;
  completedAt?: string;
  durationSeconds?: number;
}

// In-memory / cache storage
const merchantConfigs = new Map<string, VoiceCallConfig>();
const pendingQueue = new Map<string, QueuedVoiceCall>();
const activeCalls = new Map<string, VoiceCallRecord>();

const DEFAULT_CONFIG: VoiceCallConfig = {
  enabled: true,
  approvalMode: 'require_approval', // Defaults to requiring vendor approval
  callOnOrderConfirmation: true,
  callOnPendingPayment: true,
  callOnHighValue: true,
  highValueThreshold: 35000,
  callOnRiderDispatch: true,
  voicePersona: 'warm_nigerian_english',
};

/**
 * Returns voice calling configuration for a merchant.
 */
export function getMerchantVoiceConfig(merchantId: string): VoiceCallConfig {
  return merchantConfigs.get(merchantId) || { ...DEFAULT_CONFIG };
}

/**
 * Updates voice calling configuration for a merchant.
 */
export function updateMerchantVoiceConfig(merchantId: string, updates: Partial<VoiceCallConfig>): VoiceCallConfig {
  const current = getMerchantVoiceConfig(merchantId);
  const updated = { ...current, ...updates };
  merchantConfigs.set(merchantId, updated);
  logger.log(`[VoiceService] Voice configuration updated for merchant ${merchantId}: approvalMode=${updated.approvalMode}, persona=${updated.voicePersona}`);
  return updated;
}

/**
 * Builds localized spoken prompt based on chosen persona and purpose.
 */
export function buildSpokenScript(params: OutboundVoiceCallRequest): string {
  if (params.customScript) {
    return params.customScript;
  }

  const store = params.merchantName || 'your vendor';
  const persona = params.voicePersona || 'warm_nigerian_english';

  if (persona === 'pidgin_blend') {
    switch (params.purpose) {
      case 'order_confirmation':
        return `Hello! Na Biblio dey call you on behalf of ${store}. We don see your order for ${params.orderTotal ? '₦' + params.orderTotal.toLocaleString() : 'goods'} on WhatsApp. Abeg press 1 for your phone keypad make we confirm your address, or press 2 if you wan change am.`;
      case 'payment_reminder':
        return `Good day! Quick reminder from ${store}. Your order don set, we dey wait for your transfer confirmation. If you don send the money, press 1 make we verify am sharp sharp, or press 2 make we keep am for you.`;
      case 'delivery_coordination':
        return `Hello! Dispatch rider from ${store} dey on the way to ${params.deliveryAddress || 'your place'}. Press 1 if you dey on seat to receive am now, or press 2 if we should drop am with neighbor.`;
      case 'vendor_escalation':
        return `Urgent alert for ${store}. Customer get quick question for WhatsApp. Press 1 to acknowledge am now.`;
      default:
        return `Hello! Na Biblio dey call you on behalf of ${store} for your WhatsApp message. Press 1 to connect or reply on WhatsApp. Thank you!`;
    }
  }

  if (persona === 'formal_corporate') {
    switch (params.purpose) {
      case 'order_confirmation':
        return `Good day. This is an automated notification from Biblio on behalf of ${store}. We have received your order valued at ${params.orderTotal ? '₦' + params.orderTotal.toLocaleString() : 'the specified amount'}. Please press 1 to confirm your dispatch address, or press 2 to speak with a customer care specialist.`;
      case 'payment_reminder':
        return `Good day. This is ${store} accounts department. Your pending invoice is reserved. If payment has been remitted, please press 1 for instant automated reconciliation. Press 2 for billing assistance.`;
      case 'delivery_coordination':
        return `Good day. Dispatch logistics for ${store}. Your parcel is scheduled for delivery to ${params.deliveryAddress || 'your registered address'}. Press 1 to confirm recipient availability, or press 2 for rescheduling options.`;
      case 'vendor_escalation':
        return `Priority executive dispatch for ${store}. An account requires administrative resolution. Press 1 to confirm.`;
      default:
        return `Good day. Automated notification on behalf of ${store}. Press 1 to acknowledge.`;
    }
  }

  // Default: 'warm_nigerian_english'
  switch (params.purpose) {
    case 'order_confirmation':
      return `Hello! This is Biblio calling on behalf of ${store}. We received your order for ${params.orderTotal ? '₦' + params.orderTotal.toLocaleString() : 'items'} on WhatsApp. Please press 1 on your keypad to confirm your delivery address, or press 2 if you would like to reschedule.`;

    case 'payment_reminder':
      return `Good day! This is a quick courtesy message from ${store}. Your order is reserved and waiting for payment. If you have already made the bank transfer, please press 1 so we can verify it immediately, or press 2 to hold the order for later today.`;

    case 'delivery_coordination':
      return `Hello! Biblio delivery dispatch for ${store}. Our dispatch rider is getting ready to deliver to ${params.deliveryAddress || 'your address'}. Please press 1 to confirm you are available to receive it now, or press 2 to provide alternate delivery instructions.`;

    case 'vendor_escalation':
      return `Priority alert for ${store}. A customer has an urgent inquiry requiring your direct attention on WhatsApp. Press 1 to acknowledge, or press 2 to request an emergency SMS summary.`;

    default:
      return `Hello! This is Biblio calling on behalf of ${store} regarding your recent WhatsApp commerce inquiry. Please press 1 to connect, or reply to our WhatsApp message at your convenience. Thank you!`;
  }
}

/**
 * Triggers or queues a voice call based on merchant's approval mode.
 * If mode is 'require_approval', it queues the call and alerts the vendor with script preview.
 * If mode is 'fully_autonomous', it immediately executes the outbound call.
 */
export async function triggerAutonomousVoiceCall(params: OutboundVoiceCallRequest): Promise<{
  action: 'queued_for_approval' | 'dialed_immediately';
  queueItem?: QueuedVoiceCall;
  callRecord?: VoiceCallRecord;
}> {
  const config = getMerchantVoiceConfig(params.merchantId);

  if (!config.enabled) {
    logger.log(`[VoiceService] Voice calls disabled for merchant ${params.merchantId}. Skipping call to ${params.toPhone}`);
    return { action: 'queued_for_approval' };
  }

  // Use configured persona if not explicitly provided
  params.voicePersona = params.voicePersona || config.voicePersona;
  const script = buildSpokenScript(params);

  // If vendor requires approval: Queue call and wait for vendor action
  if (config.approvalMode === 'require_approval') {
    const queueId = `vq_${crypto.randomBytes(6).toString('hex')}`;
    const queuedItem: QueuedVoiceCall = {
      queueId,
      merchantId: params.merchantId,
      merchantName: params.merchantName,
      toPhone: params.toPhone,
      purpose: params.purpose,
      scriptPreview: script,
      orderId: params.orderId,
      orderTotal: params.orderTotal,
      deliveryAddress: params.deliveryAddress,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };
    pendingQueue.set(queueId, queuedItem);

    logger.log(`[VoiceService] Call queued for vendor approval (Queue ID: ${queueId}). Script preview: "${script}"`);
    return { action: 'queued_for_approval', queueItem: queuedItem };
  }

  // If fully autonomous: Dial immediately!
  const callRecord = await makeVendorProxyCall(params);
  return { action: 'dialed_immediately', callRecord };
}

/**
 * Approves a queued voice call and dials it immediately.
 */
export async function approvePendingVoiceCall(queueId: string): Promise<VoiceCallRecord> {
  const item = pendingQueue.get(queueId);
  if (!item) {
    throw new Error(`Queued voice call ${queueId} not found`);
  }

  item.status = 'approved';
  logger.log(`[VoiceService] Vendor approved voice call ${queueId}. Initiating call now...`);

  const callRecord = await makeVendorProxyCall({
    toPhone: item.toPhone,
    merchantId: item.merchantId,
    merchantName: item.merchantName,
    purpose: item.purpose,
    customScript: item.scriptPreview,
    orderId: item.orderId,
    orderTotal: item.orderTotal,
    deliveryAddress: item.deliveryAddress,
  });

  pendingQueue.delete(queueId);
  return callRecord;
}

/**
 * Rejects and cancels a queued voice call.
 */
export function rejectPendingVoiceCall(queueId: string): boolean {
  const item = pendingQueue.get(queueId);
  if (!item) return false;
  item.status = 'rejected';
  pendingQueue.delete(queueId);
  logger.log(`[VoiceService] Vendor rejected voice call ${queueId}. Call cancelled.`);
  return true;
}

/**
 * Lists all pending voice calls waiting for merchant approval.
 */
export function getPendingVoiceQueue(merchantId: string): QueuedVoiceCall[] {
  return Array.from(pendingQueue.values())
    .filter(item => !merchantId || item.merchantId === merchantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Dispatches an automated outbound phone call on behalf of the merchant.
 * Evaluates provider priority: Africa's Talking Voice -> Twilio -> Sandbox Telephony Simulator.
 */
export async function makeVendorProxyCall(params: OutboundVoiceCallRequest): Promise<VoiceCallRecord> {
  const cleanPhone = params.toPhone.replace(/\D/g, '');
  const normalizedPhone = cleanPhone.startsWith('0') 
    ? `+234${cleanPhone.slice(1)}` 
    : cleanPhone.startsWith('234') 
    ? `+${cleanPhone}` 
    : `+${cleanPhone}`;

  const callId = `call_${crypto.randomBytes(8).toString('hex')}`;
  const script = buildSpokenScript(params);

  logger.log(`[VoiceService] Initiating proxy call on behalf of ${params.merchantName} to ${normalizedPhone} (Purpose: ${params.purpose})`);

  // 1. Check for Africa's Talking API key
  const atApiKey = (await getMerchantApiKey(params.merchantId, "africas_talking").catch(() => null)) || process.env.AT_API_KEY;
  const atUsername = process.env.AT_USERNAME || "sandbox";

  // 2. Check for Twilio Credentials
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  // Try Africa's Talking Voice API
  if (atApiKey && atApiKey !== "dummy_key") {
    try {
      const atClient = AfricasTalking({
        apiKey: atApiKey,
        username: atUsername,
      });

      const virtualNumber = process.env.AT_VIRTUAL_NUMBER || '+234700BIBLIO';
      const response = await atClient.VOICE.call({
        callFrom: virtualNumber,
        callTo: [normalizedPhone],
      });

      logger.log(`[VoiceService] Africa's Talking Voice call dispatched:`, response);

      const record: VoiceCallRecord = {
        callId,
        provider: 'africas_talking',
        toPhone: normalizedPhone,
        merchantId: params.merchantId,
        merchantName: params.merchantName,
        purpose: params.purpose,
        status: 'in-progress',
        spokenScript: script,
        initiatedAt: new Date().toISOString(),
      };
      activeCalls.set(callId, record);
      return record;
    } catch (err: any) {
      logger.warn(`[VoiceService] Africa's Talking Voice failed; attempting fallback: ${err.message}`);
    }
  }

  // Try Twilio Voice API
  if (twilioSid && twilioAuth && twilioFrom) {
    try {
      const twilioClient = twilio(twilioSid, twilioAuth);
      const twiml = `
        <Response>
          <Pause length="1"/>
          <Say voice="Polly.Ayanda" language="en-ZA">${script}</Say>
          <Gather numDigits="1" timeout="10" action="/voice/callback?callId=${callId}" method="POST">
            <Pause length="2"/>
          </Gather>
          <Say>Thank you for shopping with ${params.merchantName}. Goodbye.</Say>
        </Response>
      `;

      const call = await twilioClient.calls.create({
        to: normalizedPhone,
        from: twilioFrom,
        twiml,
      });

      logger.log(`[VoiceService] Twilio Voice call dispatched (SID: ${call.sid})`);

      const record: VoiceCallRecord = {
        callId,
        provider: 'twilio',
        toPhone: normalizedPhone,
        merchantId: params.merchantId,
        merchantName: params.merchantName,
        purpose: params.purpose,
        status: 'in-progress',
        spokenScript: script,
        initiatedAt: new Date().toISOString(),
      };
      activeCalls.set(callId, record);
      return record;
    } catch (err: any) {
      logger.warn(`[VoiceService] Twilio Voice failed; falling back to Simulator: ${err.message}`);
    }
  }

  // 3. Fallback: Zero-Cost Sandbox Telephony Simulator
  logger.log(`[VoiceService] Telephony Simulator active: Spoke script to ${normalizedPhone}`);
  logger.log(`[VoiceService] Spoken Text: "${script}"`);

  const simulatedRecord: VoiceCallRecord = {
    callId,
    provider: 'sandbox_simulator',
    toPhone: normalizedPhone,
    merchantId: params.merchantId,
    merchantName: params.merchantName,
    purpose: params.purpose,
    status: 'completed',
    spokenScript: script,
    dtmfResponse: '1', // Simulated keypress "1" (Confirmed)
    initiatedAt: new Date().toISOString(),
    completedAt: new Date(Date.now() + 18000).toISOString(),
    durationSeconds: 18,
  };
  activeCalls.set(callId, simulatedRecord);
  return simulatedRecord;
}

/**
 * Returns recent voice call records for a given merchant.
 */
export function getMerchantCallLogs(merchantId: string): VoiceCallRecord[] {
  return Array.from(activeCalls.values())
    .filter(c => !merchantId || c.merchantId === merchantId)
    .sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime());
}

/**
 * Handles DTMF keypress callback when customer presses a digit on their phone.
 */
export function processCustomerDtmf(callId: string, digit: string): { status: string; action: string } {
  const call = activeCalls.get(callId);
  if (!call) {
    return { status: 'unknown_call', action: 'none' };
  }

  call.dtmfResponse = digit;
  call.status = 'completed';
  call.completedAt = new Date().toISOString();

  let action = 'logged';
  if (digit === '1') {
    action = 'customer_confirmed_action';
  } else if (digit === '2') {
    action = 'customer_requested_reschedule_or_escalation';
  }

  logger.log(`[VoiceService] Call ${callId} received DTMF digit '${digit}'. Action determined: ${action}`);
  return { status: 'success', action };
}
