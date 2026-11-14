import { Groq } from "groq-sdk";
import { sql, redis } from "@ace/shared/clients";
import { loadNegotiatorEnv } from "@ace/shared/env.js";
import type { ConversationTurn } from "@ace/shared/types";
import { sendCustomerMessage } from "../../comms-router/src/outbound.js";
import { logger } from "@ace/shared/logger.js";
import { routerTools, subAgentToolsets, subAgentPrompts } from "./routerConfig.js";
import { toolHandlers } from "./toolHandlers.js";
import { recordTokenUsage, groqTokensToNaira } from "@ace/shared/tokenLedger.js";

const env = loadNegotiatorEnv();
const groq = new Groq({ apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY || "" });
const MODEL = env.GROQ_MODEL || process.env.GROQ_MODEL || "llama3-70b-8192";
const MAX_BIBLIO_ITERATIONS = 10;
const LOCK_TTL_SECONDS = 120;

export async function runBiblioAgentTurn(turn: ConversationTurn, channel: "whatsapp" | "in_app" = "whatsapp"): Promise<string> {
  const { customerId: merchantPhone, merchantId, messages } = turn;
  
  if (messages.length === 0) return "";
  const lastMsg = messages[messages.length - 1];
  
  if ((lastMsg as any).fromMe || !(lastMsg.content as any)?.text) {
    return ""; // Only process inbound text from the merchant
  }

  const userText = (lastMsg.content as any).text;
  let textToProcess = userText;

  // Extract images from text if present
  const imageRegex = /\[Image:\s*(https?:\/\/[^\]]+)\]/g;
  const imageMatches = [...userText.matchAll(imageRegex)];
  const imageUrls = imageMatches.map(m => m[1]);
  if (imageUrls.length > 0) {
    textToProcess += `\n\n(Attached images: ${imageUrls.join(", ")})`;
  }

  // 1. Fetch live merchant profile & settings
  const merchantRows = await sql<{
    name: string;
    owner_first_name: string;
    owner_last_name: string;
    bank_details: any;
    bank_account_number: string;
    payout_frequency: string;
    fee_padding_model: string;
    platform_fee_percent: number;
    onboarding_state: string;
    is_registered: boolean;
    rc_number: string;
    business_type: string;
    tax_id: string;
    support_email: string;
    support_phone: string;
    website_url: string;
    physical_address: any;
    operating_hours: any;
    return_policy: string;
    delivery_notes: string;
    delivery_info: string;
    dialect: string;
    tone_guide: string;
    default_discount_pct: number;
  }[]>`
    SELECT name, owner_first_name, owner_last_name, bank_details, bank_account_number, payout_frequency,
           fee_padding_model, platform_fee_percent, onboarding_state,
           is_registered, rc_number, business_type, tax_id, support_email, support_phone,
           website_url, physical_address, operating_hours, return_policy, delivery_notes, delivery_info,
           dialect, tone_guide, default_discount_pct
    FROM merchants WHERE id = ${merchantId} LIMIT 1
  `;
  const m = merchantRows[0] || {
    name: "Your Store",
    owner_first_name: "Merchant",
    owner_last_name: "",
    bank_details: {},
    bank_account_number: "",
    payout_frequency: "instant",
    fee_padding_model: "customer_padded",
    platform_fee_percent: 3.0,
    onboarding_state: "completed",
    is_registered: false,
    rc_number: "",
    business_type: "SOLE_PROPRIETOR",
    tax_id: "",
    support_email: "",
    support_phone: "",
    website_url: "",
    physical_address: {},
    operating_hours: {},
    return_policy: "",
    delivery_notes: "",
    delivery_info: "",
    dialect: "english",
    tone_guide: "",
    default_discount_pct: 0
  };

  // 2. Fetch recent customer WhatsApp inquiries
  const recentInquiries = await sql<{
    customer_id: string;
    source: string;
    content: string;
    created_at: string;
  }[]>`
    SELECT customer_id, source, content, created_at
    FROM conversation_messages
    WHERE merchant_id = ${merchantId}::uuid
    ORDER BY created_at DESC
    LIMIT 6
  `.catch(() => []);

  const hourWAT = (new Date().getUTCHours() + 1) % 24;
  const timeOfDay = hourWAT < 12 ? "Good morning" : hourWAT < 17 ? "Good afternoon" : "Good evening";
  const ownerName = m.owner_first_name && m.owner_first_name !== "Merchant" ? m.owner_first_name : "";
  const personalizedGreeting = ownerName ? `${timeOfDay} ${ownerName}` : `${timeOfDay}`;

  // Safely parse bank_details which postgres-js returns as JSON string or object
  let bankObj: any = {};
  if (typeof m.bank_details === "string") {
    try { bankObj = JSON.parse(m.bank_details); } catch { bankObj = {}; }
  } else if (m.bank_details && typeof m.bank_details === "object") {
    bankObj = m.bank_details;
  }
  const bankName = String(bankObj.bankName || bankObj.bank_name || bankObj.bank || "").trim();
  const accountNumber = String(bankObj.accountNumber || bankObj.account_number || m.bank_account_number || "").trim();
  const accountName = String(bankObj.accountName || bankObj.account_name || "").trim();

  const hasLinkedBank = !!(bankName && accountNumber);
  const bankDisplay = hasLinkedBank
    ? `${bankName} (${accountNumber}${accountName ? ` - ${accountName}` : ""})`
    : (accountNumber ? `Linked Account (${accountNumber}${accountName ? ` - ${accountName}` : ""})` : "Not configured yet");

  const inquiriesContext = recentInquiries.length === 0
    ? "Customer WhatsApp Inquiries: 0 customer messages logged so far. (When asked about recent customer inquiries, state clearly that no customer messages have arrived on their WhatsApp line yet, and that once buyers send messages, they will appear here immediately)."
    : `Recent Customer Inquiries (${recentInquiries.length}):\n` + recentInquiries.map((inq, i) => `  ${i+1}. [${inq.source || 'WhatsApp'}] ${inq.customer_id}: "${(inq.content || '').replace(/\n/g, ' ').slice(0, 80)}"`).join("\n");

  const providusVanContext = `PROVIDUS VAN SETTLEMENT SYSTEM:
- Providus Virtual Account Numbers (VAN) are Biblio's automated zero-deduction settlement rails.
- For every customer checkout on WhatsApp, Biblio generates a unique Providus VAN for the customer to transfer funds to.
- Under Biblio's Zero-Deduction fee model, the buyer pays the 2% VAN fee and Biblio platform fee padded on top. The merchant receives 100% of their product price without any deductions.
- Destination Payout Account: ${bankDisplay}
${hasLinkedBank 
  ? "- Instant auto-settlement is active. All cleared buyer payments sweep immediately into this destination account."
  : "- No destination payout bank is linked yet. Providus VAN holds incoming customer funds in verified escrow until the merchant provides their destination bank account. If the merchant asks to setup their settlement account, ask them for their Bank Name, 10-digit Account Number, and Account Name, and call 'set_settlement_account' to link it."
}`;

  let addrObj: any = {};
  if (typeof m.physical_address === "string") {
    try { addrObj = JSON.parse(m.physical_address); } catch { addrObj = { address: m.physical_address }; }
  } else if (m.physical_address && typeof m.physical_address === "object") {
    addrObj = m.physical_address;
  }
  const addressDisplay = addrObj.street || addrObj.address || m.delivery_info || "Not set yet";

  let hoursObj: any = {};
  if (typeof m.operating_hours === "string") {
    try { hoursObj = JSON.parse(m.operating_hours); } catch { hoursObj = {}; }
  } else if (m.operating_hours && typeof m.operating_hours === "object") {
    hoursObj = m.operating_hours;
  }
  const hoursDisplay = Object.keys(hoursObj).length > 0
    ? JSON.stringify(hoursObj)
    : "Mon-Sat 8:00 AM - 6:00 PM WAT";

  const legalStatusDisplay = m.rc_number
    ? `Registered with CAC (${m.rc_number} - ${m.business_type || 'Registered Entity'})`
    : (m.is_registered ? 'Registered Business' : 'Sole Proprietorship');

  // ── Dynamic Tone, Language & Dialect Inference Engine ──
  const userTextClean = userText.trim();
  const lowerText = userTextClean.toLowerCase();

  // Explicit Directives from User:
  const explicitEnglishDirective = /\b(speak|talk|use|write|switch to|prefer)\s+(in\s+)?(proper\s+|standard\s+)?english\b|\benglish\s+please\b|\bdon'?t\s+(speak|use|talk\s+in)\s+pidgin\b|\bstop\s+pidgin\b/i.test(lowerText);
  const explicitPidginDirective = /\b(speak|talk|use|write|switch to|prefer)\s+(in\s+)?(pidgin|broken)\b|\bpidgin\s+please\b/i.test(lowerText);

  // Slang & Dialect Indicators:
  const pidginRegex = /\b(wetin|abeg|dey|fit|oya|no be|don|na so|wahala|sha|sef|abi|dem|chop|commot|comot|kwanu|ke|nna|jare|biko|shey|na|bros|wetin dey|how far|no vex)\b/i;
  const englishFormalRegex = /\b(please|kindly|could you|would you|assist|regards|thank you|hello|good morning|good afternoon|good evening|inquire|update|schedule|confirm|verify)\b/i;

  let activeDialect: string = "english";

  if (explicitEnglishDirective) {
    activeDialect = "english";
    // Persist explicitly chosen preference to DB
    await sql`UPDATE merchants SET dialect = 'english', updated_at = NOW() WHERE id = ${merchantId}::uuid`.catch(() => {});
  } else if (explicitPidginDirective) {
    activeDialect = "pidgin";
    await sql`UPDATE merchants SET dialect = 'pidgin', updated_at = NOW() WHERE id = ${merchantId}::uuid`.catch(() => {});
  } else if (m.dialect && m.dialect !== "pidgin") {
    activeDialect = m.dialect.toLowerCase();
  } else {
    // Dynamic Adaptive Inference: First start with proper English; adapt if user speaks Pidgin
    const pidginMatches = (userTextClean.match(new RegExp(pidginRegex.source, 'gi')) || []).length;
    const isEnglishStyle = englishFormalRegex.test(lowerText) || pidginMatches === 0;

    if (isEnglishStyle) {
      activeDialect = "english";
    } else if (pidginMatches >= 2) {
      activeDialect = "pidgin";
    } else {
      activeDialect = "english";
    }
  }

  const dialectRulesMap: Record<string, string> = {
    english: "Speak in clear, professional, warm, and proper English first. Do NOT use Pidgin or slang. The merchant expects clean, standard English communication.",
    pidgin: "Speak in natural, respectful, light Nigerian Pidgin. Be concise and commercial. Never use forced slang or 'sharp sharp'.",
    yoruba: "Speak primarily in clear English infused with warm, polite Yoruba commercial courtesies (e.g. 'E kaaro', 'E ku ise', 'Bawo ni').",
    igbo: "Speak primarily in clear English infused with warm, polite Igbo commercial phrasing (e.g. 'Nno', 'Daalu', 'Kedu').",
    hausa: "Speak primarily in clear English infused with warm, polite Hausa greetings (e.g. 'Sannu', 'Madalla').",
  };
  const dialectGuidanceText = dialectRulesMap[activeDialect] || dialectRulesMap.english;

  const businessProfileContext = `STORE BUSINESS PROFILE & POLICIES:
- Store Name: "${m.name}"
- Legal Status: ${legalStatusDisplay}
- Warehouse / Pickup Address: ${addressDisplay}
- Operating Hours: ${hoursDisplay}
- Return & Refund Policy: ${m.return_policy || 'Standard store return policy (items eligible for return upon inspection).'}
- Delivery & Courier Notes: ${m.delivery_notes || m.delivery_info || 'Same-day / next-day dispatch via verified couriers.'}
- Support Line: ${m.support_phone || merchantPhone || 'Direct WhatsApp Line'}
- Dialect: ${activeDialect} (${dialectGuidanceText})`;

  const toneAndStyleRules = `COMMUNICATION STYLE & TONE GUIDELINES:
1. Speak as an experienced, sharp, respectful Nigerian commercial partner / COO. ${dialectGuidanceText}
2. TONE & DIALECT COMPLIANCE: If the active dialect is 'english' (or if the user speaks English or asks for English), YOU MUST REPLY IN PROPER ENGLISH. NEVER force Pidgin when the user prefers English. Adapt your language dynamically to mirror the user's communication style.
3. ABSOLUTELY NO MARKDOWN BOLD ASTERISKS (**word**). Never output ** or __ around any words. Write in clean, normal text.
4. NO EMOJI SPAM. Use zero emojis or at most one subtle emoji in the entire message. Never output bulleted lists of emojis (no 🚀, ✨, 🛒, 💼, 🤖, 🔥).
5. NEVER say you lack access to WhatsApp chat logs, customer inquiries, or store data. You have direct database access to all store logs, customer messages, inventory, orders, and settlements.
6. Be concise, direct, and actionable. Zero generic AI filler, no robotic declarations, no corporate fluff.`;

  // Log inbound turn to transcript table
  await sql`
    INSERT INTO merchant_agent_transcripts (merchant_id, channel, sender_role, content, metadata)
    VALUES (${merchantId}, ${channel}, 'vendor', ${textToProcess}, ${JSON.stringify({ phone: merchantPhone })}::jsonb)
  `.catch(e => logger.warn("[BiblioAgent] Transcript insert failed", e));

  // --- STEP 1: ROUTER AGENT ---
  const routerSystemPrompt = `You are Biblio, the autonomous AI business assistant for ${ownerName || "the store owner"}.
Store: "${m.name}"
Owner: "${ownerName || 'Merchant'}"
Fee Padding Model: ${m.fee_padding_model} (${m.platform_fee_percent}% Biblio platform take rate)
Bank Account: ${bankDisplay}
Payout Frequency: ${m.payout_frequency || 'instant'}
Onboarding State: ${m.onboarding_state || 'completed'}

${inquiriesContext}

${providusVanContext}

${businessProfileContext}

${toneAndStyleRules}

ADDRESSING & IDENTITY RULES:
1. Always address the owner as "${personalizedGreeting}" if this is a greeting or initial request.
2. If the user asks about fees or payments, or if onboarding_state is 'pending', make them aware of Biblio's Zero-Deduction Fee Padding Model: "When you price an item at ₦20,000, your buyer is invoiced ₦21,000 (2% VAN fee + Biblio platform fee padded on top). You receive 100% of your ₦20,000 directly into your bank without deductions!"
3. If onboarding_state is 'pending' or 'tutorial_offered', prompt them to set their profile/bank or ask if they'd like a quick 2-minute interactive demo to learn how Biblio manages their store.
4. Analyze the vendor's request and route it to the correct specialized sub-agent.
5. If the vendor is just saying hello, asking a general question, asking for inquiries when context is available, or replying to onboarding, use direct_reply. Otherwise, select exactly ONE routing tool.`;

  const conversation: any[] = [
    { role: "user", content: textToProcess }
  ];

  let finalReplyText = "";

  const dispatchReply = async (rawText: string) => {
    // Sanitize any raw markdown bold asterisks or excessive formatting
    const cleanText = (rawText || "")
      .replace(/\*\*(.*?)\*\*/g, '$1')   // Remove bold asterisks
      .replace(/\*(.*?)\*/g, '$1')       // Remove italic asterisks
      .replace(/__(.*?)__/g, '$1')       // Remove bold underscores
      .replace(/^#{1,4}\s+/gm, '')       // Remove markdown headers
      .replace(/^---+$/gm, '')           // Remove horizontal rules
      .trim();

    finalReplyText = cleanText;
    if (channel === "whatsapp" && merchantPhone) {
      await sendCustomerMessage({
        toPhone: merchantPhone,
        text: cleanText
      });
    }
    // Record outbound to transcript
    await sql`
      INSERT INTO merchant_agent_transcripts (merchant_id, channel, sender_role, content, metadata)
      VALUES (${merchantId}, ${channel}, 'agent', ${cleanText}, ${JSON.stringify({ timestamp: Date.now() })}::jsonb)
    `.catch(e => logger.warn("[BiblioAgent] Outbound transcript insert failed", e));

    // Publish to Redis for real-time mobile app sync
    await redis.publish(`agent:stream:${merchantId}`, JSON.stringify({
      channel,
      sender_role: "agent",
      content: cleanText,
      created_at: new Date().toISOString()
    })).catch(e => logger.warn("[BiblioAgent] PubSub failed", e));
  };

  try {
    await logger.log(`[BiblioAgent] Invoking Router Agent for merchant ${merchantId} (${ownerName})...`, { merchantId });
    
    const routerResponse = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: routerSystemPrompt },
        ...conversation
      ],
      tools: routerTools,
      tool_choice: "auto",
      max_tokens: 1024,
      temperature: 0.1
    });

    const routerMessage = routerResponse.choices[0].message;
    const toolCalls = routerMessage.tool_calls;

    // Record router agent token usage
    const routerTokens = routerResponse.usage?.total_tokens ?? 0;
    if (routerTokens > 0) {
      recordTokenUsage(merchantId, 'Autonomous WhatsApp Replies', routerTokens, groqTokensToNaira(routerTokens), { stage: 'router' }).catch(() => {});
    }

    if (!toolCalls || toolCalls.length === 0) {
      if (routerMessage.content) {
        await dispatchReply(routerMessage.content as string);
      }
      return finalReplyText;
    }

    const toolCall = toolCalls[0];
    const routeName = toolCall.function.name;

    // Handle direct reply
    if (routeName === "direct_reply") {
      const args = JSON.parse(toolCall.function.arguments);
      await dispatchReply(args.reply);
      return finalReplyText;
    }

    // Check if it's a valid sub-agent route
    if (!subAgentToolsets[routeName]) {
      await logger.error(`[BiblioAgent] Unknown route ${routeName}`, { merchantId });
      return "";
    }

    // --- STEP 2: SUB-AGENT EXECUTION ---
    const subAgentTools = subAgentToolsets[routeName];
    const subAgentSystemPrompt = subAgentPrompts[routeName] + `
You are talking directly to ${ownerName || "the merchant"}. Address them warmly as "${personalizedGreeting}" when greeting.
Store: "${m.name}"
Fee Padding Model: ${m.fee_padding_model} (${m.platform_fee_percent}% platform cut)

${inquiriesContext}

${providusVanContext}

${businessProfileContext}

${toneAndStyleRules}
`;

    await logger.log(`[BiblioAgent] Routing to Sub-Agent: ${routeName}`, { merchantId });

    const subAgentResponse = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: subAgentSystemPrompt },
        ...conversation
      ],
      tools: subAgentTools,
      tool_choice: "auto",
      max_tokens: 1024,
      temperature: 0.2
    });

    const subAgentMessage = subAgentResponse.choices[0].message;
    const subAgentToolCalls = subAgentMessage.tool_calls;

    // Record sub-agent token usage
    const subAgentTokens = subAgentResponse.usage?.total_tokens ?? 0;
    if (subAgentTokens > 0) {
      recordTokenUsage(merchantId, 'Autonomous WhatsApp Replies', subAgentTokens, groqTokensToNaira(subAgentTokens), { stage: 'sub_agent', route: routeName }).catch(() => {});
    }

    if (subAgentToolCalls && subAgentToolCalls.length > 0) {
      const toolMessages: any[] = [];
      for (const call of subAgentToolCalls) {
        const name = call.function.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        
        await logger.log(`[BiblioAgent] Sub-Agent executing tool ${name}`, { merchantId, args });
        
        let toolResult = "";
        
        // Execute dynamic tool handler
        if (toolHandlers[name]) {
          try {
            toolResult = await toolHandlers[name](merchantId, args);
          } catch (err: any) {
            toolResult = `Failed to execute ${name}: ${err.message}`;
            await logger.error(`[BiblioAgent] Tool execution failed`, { merchantId, name, err });
          }
        } else {
          toolResult = `Error: Tool '${name}' is not registered in toolHandlers.`;
          await logger.warn(`[BiblioAgent] Unregistered tool called`, { merchantId, name });
        }

        toolMessages.push({
          role: "tool",
          tool_call_id: call.id,
          content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult)
        });
      }

      // --- STEP 3: SUB-AGENT FINAL SYNTHESIS RESPONSE ---
      const finalResponse = await groq.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: subAgentSystemPrompt },
          ...conversation,
          subAgentMessage,
          ...toolMessages
        ],
        max_tokens: 1024,
        temperature: 0.2
      });

      if (finalResponse.choices[0]?.message?.content) {
        await dispatchReply(finalResponse.choices[0].message.content);
      }

      // Record final synthesis token usage
      const finalTokens = finalResponse.usage?.total_tokens ?? 0;
      if (finalTokens > 0) {
        recordTokenUsage(merchantId, 'Autonomous WhatsApp Replies', finalTokens, groqTokensToNaira(finalTokens), { stage: 'synthesis' }).catch(() => {});
      }
    } else if (subAgentMessage.content) {
      await dispatchReply(subAgentMessage.content as string);
    }

    return finalReplyText;

  } catch (err) {
    await logger.error(`[biblioAgentLoop] Error running agent turn:`, { merchantId, err });
    return "";
  }
}
