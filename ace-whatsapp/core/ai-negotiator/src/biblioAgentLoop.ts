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

export async function runBiblioAgentTurn(turn: ConversationTurn): Promise<void> {
  const { customerId: merchantPhone, merchantId, messages } = turn;
  
  if (messages.length === 0) return;
  const lastMsg = messages[messages.length - 1];
  
  if ((lastMsg as any).fromMe || !(lastMsg.content as any)?.text) {
    return; // Only process inbound text from the merchant
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

  // --- STEP 1: ROUTER AGENT ---
  const routerSystemPrompt = `You are the ACE Hierarchical Router Agent.
Your job is to analyze the vendor's request and route it to the correct specialized sub-agent.
If the vendor is just saying hello or asking a general non-operational question, use the direct_reply tool.
Otherwise, select exactly ONE routing tool that best matches their intent.`;

  const conversation: any[] = [
    { role: "user", content: textToProcess }
  ];

  try {
    await logger.log(`[BiblioAgent] Invoking Router Agent for merchant ${merchantId}...`, { merchantId });
    
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
      // LLM decided not to use a tool, just send its text reply
      if (routerMessage.content) {
        await sendCustomerMessage({
          toPhone: merchantPhone,
          text: routerMessage.content as string
        });
      }
      return;
    }

    const toolCall = toolCalls[0];
    const routeName = toolCall.function.name;

    // Handle direct reply
    if (routeName === "direct_reply") {
      const args = JSON.parse(toolCall.function.arguments);
      await sendCustomerMessage({
        toPhone: merchantPhone,
        text: args.reply
      });
      return;
    }

    // Check if it's a valid sub-agent route
    if (!subAgentToolsets[routeName]) {
      await logger.error(`[BiblioAgent] Unknown route ${routeName}`, { merchantId });
      return;
    }

    // --- STEP 2: SUB-AGENT EXECUTION ---
    const subAgentTools = subAgentToolsets[routeName];
    const subAgentSystemPrompt = subAgentPrompts[routeName] + `
You are talking directly to the merchant on WhatsApp. Keep your responses extremely concise, professional, and actionable.
Call the appropriate tools to fulfill their request.
If you need to extract images to add to the inventory, use the image URLs provided in the vendor's message string.`;

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
          toolResult = `Tool ${name} executed successfully (mocked).`;
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
          await sendCustomerMessage({
            toPhone: merchantPhone,
            text: finalResponse.choices[0].message.content
          });
        }
      }
    } else if (subAgentMessage.content) {
      await sendCustomerMessage({
        toPhone: merchantPhone,
        text: subAgentMessage.content as string
      });
    }

  } catch (err) {
    await logger.error(`[biblioAgentLoop] Error running agent turn:`, { merchantId, err });
  }
}
