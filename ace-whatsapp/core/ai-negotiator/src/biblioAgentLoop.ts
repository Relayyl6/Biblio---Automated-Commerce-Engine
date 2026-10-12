import { Groq } from "groq-sdk";
import { sql, redis } from "@ace/shared/clients";
import { loadNegotiatorEnv } from "@ace/shared/env.js";
import type { ConversationTurn } from "@ace/shared/types";
import { sendCustomerMessage } from "../../comms-router/src/outbound.js";
import { logger } from "@ace/shared/logger.js";
import { routerTools, subAgentToolsets, subAgentPrompts } from "./routerConfig.js";
import { toolHandlers } from "./toolHandlers.js";

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
    bank_details: any;
    payout_frequency: string;
    fee_padding_model: string;
    platform_fee_percent: number;
    onboarding_state: string;
  }[]>`
    SELECT name, owner_first_name, bank_details, payout_frequency,
           fee_padding_model, platform_fee_percent, onboarding_state
    FROM merchants WHERE id = ${merchantId} LIMIT 1
  `;
  const m = merchantRows[0] || {
    name: "Your Store",
    owner_first_name: "Merchant",
    bank_details: {},
    payout_frequency: "instant",
    fee_padding_model: "customer_padded",
    platform_fee_percent: 3.0,
    onboarding_state: "completed"
  };

  const hourWAT = (new Date().getUTCHours() + 1) % 24;
  const timeOfDay = hourWAT < 12 ? "Good morning" : hourWAT < 17 ? "Good afternoon" : "Good evening";
  const ownerName = m.owner_first_name && m.owner_first_name !== "Merchant" ? m.owner_first_name : "";
  const personalizedGreeting = ownerName ? `${timeOfDay} ${ownerName}` : `${timeOfDay}`;

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
Bank Account: ${m.bank_details?.bankName ? `${m.bank_details.bankName} (${m.bank_details.accountNumber})` : 'Not configured yet'}
Payout Frequency: ${m.payout_frequency || 'instant'}
Onboarding State: ${m.onboarding_state || 'completed'}

ADDRESSING & IDENTITY RULES:
1. Always address the owner as "${personalizedGreeting}" if this is a greeting or initial request.
2. If the user asks about fees or payments, or if onboarding_state is 'pending', make them aware of Biblio's Zero-Deduction Fee Padding Model: "When you price an item at ₦20,000, your buyer is invoiced ₦21,000 (2% VAN fee + Biblio platform fee padded on top). You receive 100% of your ₦20,000 directly into your bank without deductions!"
3. If onboarding_state is 'pending' or 'tutorial_offered', prompt them to set their profile/bank or ask if they'd like a quick 2-minute interactive demo to learn how Biblio manages their store.
4. Analyze the vendor's request and route it to the correct specialized sub-agent.
5. If the vendor is just saying hello, asking a general question, or replying to onboarding, use direct_reply. Otherwise, select exactly ONE routing tool.`;

  const conversation: any[] = [
    { role: "user", content: textToProcess }
  ];

  let finalReplyText = "";

  const dispatchReply = async (text: string) => {
    finalReplyText = text;
    if (channel === "whatsapp" && merchantPhone) {
      await sendCustomerMessage({
        toPhone: merchantPhone,
        text
      });
    }
    // Record outbound to transcript
    await sql`
      INSERT INTO merchant_agent_transcripts (merchant_id, channel, sender_role, content, metadata)
      VALUES (${merchantId}, ${channel}, 'agent', ${text}, ${JSON.stringify({ timestamp: Date.now() })}::jsonb)
    `.catch(e => logger.warn("[BiblioAgent] Outbound transcript insert failed", e));

    // Publish to Redis for real-time mobile app sync
    await redis.publish(`agent:stream:${merchantId}`, JSON.stringify({
      channel,
      sender_role: "agent",
      content: text,
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
Keep responses extremely concise, professional, and actionable. Call the appropriate tools to fulfill their request.`;

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

    if (subAgentToolCalls && subAgentToolCalls.length > 0) {
      for (const call of subAgentToolCalls) {
        const name = call.function.name;
        const args = JSON.parse(call.function.arguments);
        
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

        // --- STEP 3: SUB-AGENT FINAL RESPONSE ---
        const finalResponse = await groq.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: subAgentSystemPrompt },
            ...conversation,
            subAgentMessage,
            { role: "tool", tool_call_id: call.id, content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult) }
          ],
          max_tokens: 1024,
          temperature: 0.2
        });

        if (finalResponse.choices[0].message.content) {
          await dispatchReply(finalResponse.choices[0].message.content);
        }
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
