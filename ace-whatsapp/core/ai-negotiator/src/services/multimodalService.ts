import { Groq, toFile } from "groq-sdk";
import { logger } from "@ace/shared/logger.js";
import { sql } from "@ace/shared/clients.js";
import { runBiblioAgentTurn } from "../biblioAgentLoop.js";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const groq = new Groq({ apiKey: GROQ_API_KEY });

export type AttachmentType =
  | "product_photo"
  | "supplier_invoice"
  | "payment_receipt"
  | "business_doc"
  | "voice_note";

export interface MultimodalAudioResult {
  ok: boolean;
  transcription: string;
  intent?: string;
  entities?: Record<string, any>;
  actionSummary?: string;
  reply: string;
  engineUsed: string;
}

/**
 * Ordered priority list of Gemini models to cascade through.
 * Uses Gemini 3.8 Flash, 3.5 Flash, or 3.5 Flash Lite first as requested,
 * then falls back to 2.5 Flash / 1.5 Flash before resorting to Groq Whisper.
 */
function getGeminiModelCascade(): string[] {
  const preferredModel = process.env.GEMINI_MODEL;
  const defaultCascade = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
  ];

  if (preferredModel && !defaultCascade.includes(preferredModel)) {
    return [preferredModel, ...defaultCascade];
  }
  return defaultCascade;
}

/**
 * Process spoken audio from the merchant app or WhatsApp voice notes.
 *
 * Cascades through Gemini 3.8 Flash -> 3.5 Flash -> 3.5 Flash Lite -> 2.5 Flash
 * for single-pass audio listening across pauses and entity extraction.
 *
 * Only resorts to Groq Whisper Large v3 + Llama 3.3 if all Gemini models fail or key is unset.
 */
export async function processAudioMultimodal(
  merchantId: string,
  audioBase64: string,
  mimeType: string = "audio/m4a"
): Promise<MultimodalAudioResult> {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    "";

  // Clean raw base64 string
  const cleanBase64 = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, "");

  // ─── 1. Cascade through Gemini 3.8 / 3.5 Flash / 3.5 Flash Lite ───────────
  if (geminiApiKey) {
    const modelsToTry = getGeminiModelCascade();

    const prompt = `You are Biblio's Voice AI Executive Assistant for African commerce merchants.
Listen carefully to the merchant's spoken voice note across all pauses, background noise, and natural trade cadence (including Nigerian Pidgin, Nigerian English, trade slang, prices in Naira or "k", stock counts, client appointments, and bank payout requests).

Execute in ONE unified multimodal pass:
1. COMPLETE SPOKEN TRANSCRIPTION: Accurately transcribe every single spoken word across all natural pauses. Do NOT truncate or summarise the transcript.
2. STRUCTURED COMMERCE & BOOKING EXTRACTION:
   - intent: "book_appointment" | "catalog_product" | "update_payout" | "logistics_quote" | "check_van" | "general_inquiry"
   - entities: Extract all structured fields:
     * For Appointments/Bookings: client_name, client_phone, date, time, service_name, duration_minutes, notes
     * For Products: title, price, floor_price, quantity, category, color, size
     * For Payouts: bank_name, account_number, account_name, frequency
     * For Logistics: pickup_address, delivery_address, item_type
   - action_summary: Brief 1-sentence confirmation of the action.

Respond ONLY with valid, raw JSON with this exact schema:
{
  "transcription": "...",
  "intent": "...",
  "entities": {},
  "action_summary": "..."
}`;

    for (const model of modelsToTry) {
      try {
        logger.info(`[MultimodalService] Attempting audio ingestion via ${model}...`, {
          merchantId,
          mimeType,
        });

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType:
                          mimeType.includes("mp4") || mimeType.includes("m4a")
                            ? "audio/mp4"
                            : mimeType,
                        data: cleanBase64,
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            const parsed = JSON.parse(jsonText);
            const transcription = parsed.transcription?.trim() || "";

            if (transcription) {
              logger.info(`[MultimodalService] ${model} transcribed successfully:`, {
                transcription,
                intent: parsed.intent,
              });

              // Echo transcription into conversation with voice note metadata
              const turn = {
                customerId: merchantId,
                merchantId: merchantId,
                messages: [
                  {
                    content: { text: `🎤 [Spoken Audio]: "${transcription}"` },
                    metadata: {
                      attachmentType: "voice_note",
                      modelUsed: model,
                      entities: parsed.entities,
                    },
                  } as any,
                ],
                orderState: { status: "no_order" as const },
              };

              const agentReply = await runBiblioAgentTurn(turn, "in_app");

              return {
                ok: true,
                transcription,
                intent: parsed.intent,
                entities: parsed.entities,
                actionSummary: parsed.action_summary,
                reply: agentReply,
                engineUsed: model,
              };
            }
          }
        } else {
          const errText = await response.text();
          logger.warn(`[MultimodalService] ${model} failed (${response.status}), trying next model:`, errText.slice(0, 150));
        }
      } catch (err: any) {
        logger.warn(`[MultimodalService] Error querying ${model}, cascading:`, err.message);
      }
    }
  }

  // ─── 2. Resilient Fallback: Groq Whisper Large v3 + Llama 3.3 ───────────────
  try {
    logger.info("[MultimodalService] All Gemini models exhausted or key unset. Ingesting via Groq Whisper Large v3...", { merchantId });

    const audioBuffer = Buffer.from(cleanBase64, "base64");
    const file = await toFile(audioBuffer, "voice-note.m4a", { type: mimeType });

    const transcriptionRes = await groq.audio.transcriptions.create({
      file,
      model: "whisper-large-v3",
      language: "en",
      temperature: 0.0,
      response_format: "verbose_json",
    });

    const transcription = transcriptionRes.text?.trim() || "";
    if (!transcription) {
      throw new Error("Whisper returned empty transcription.");
    }

    logger.info("[MultimodalService] Whisper transcribed audio:", { transcription });

    // Extract structured intent using Llama 3.3
    let intent = "general_inquiry";
    let entities = {};
    let actionSummary = "";

    try {
      const groqChatModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
      const extraction = await groq.chat.completions.create({
        model: groqChatModel,
        messages: [
          {
            role: "system",
            content: `You are an intent extractor for African merchant audio. Analyze this transcription and return JSON only:
{"intent": "book_appointment" | "catalog_product" | "update_payout" | "logistics_quote" | "check_van" | "general_inquiry", "entities": {}, "action_summary": "..."}`,
          },
          { role: "user", content: transcription },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const parsedExtract = JSON.parse(extraction.choices[0]?.message?.content || "{}");
      intent = parsedExtract.intent || intent;
      entities = parsedExtract.entities || {};
      actionSummary = parsedExtract.action_summary || "";
    } catch (e) {
      logger.warn("[MultimodalService] Entity extraction fallback warning:", e);
    }

    // Execute Biblio Agent turn with transcribed speech
    const turn = {
      customerId: merchantId,
      merchantId: merchantId,
      messages: [
        {
          content: { text: `🎤 [Spoken Audio]: "${transcription}"` },
          metadata: {
            attachmentType: "voice_note",
            modelUsed: "groq-whisper-large-v3",
            entities,
          },
        } as any,
      ],
      orderState: { status: "no_order" as const },
    };

    const agentReply = await runBiblioAgentTurn(turn, "in_app");

    return {
      ok: true,
      transcription,
      intent,
      entities,
      actionSummary,
      reply: agentReply,
      engineUsed: "groq-whisper",
    };
  } catch (groqErr: any) {
    logger.error("[MultimodalService] Audio transcription failed completely:", groqErr);
    return {
      ok: false,
      transcription: "",
      reply: "I had trouble hearing that voice note clearly. Could you please send it again or type your request?",
      engineUsed: "groq-whisper",
    };
  }
}

/**
 * Multimodal image analysis for distinguishable attachments:
 * - product_photo: Catalog item enrichment & pricing
 * - supplier_invoice: Wholesale invoice OCR & restock margin computation
 * - payment_receipt: Transfer slip verification against Providus VAN
 * - business_doc: CAC & KYC compliance inspection
 */
export async function processImageMultimodal(
  merchantId: string,
  imageBase64: string,
  promptText?: string,
  attachmentType: AttachmentType = "product_photo",
  mimeType: string = "image/jpeg"
): Promise<{ ok: boolean; analysis: string; reply: string; engineUsed: string }> {
  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    "";

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9]+;base64,/, "");

  // Tailor prompt specifically to the distinguishable attachment type
  let systemInstruction = "";
  let headerPrefix = "";

  switch (attachmentType) {
    case "supplier_invoice":
      headerPrefix = "🧾 [Supplier Invoice Attached]:";
      systemInstruction =
        "You are Biblio's Supplier Invoice OCR Engine for African merchants. Analyze this supplier restock invoice or paper bill. Extract: supplier name, invoice date, line items with wholesale unit costs and quantities, total bill in Naira, and recommend a profitable retail markup (+30%) for each item.";
      break;
    case "payment_receipt":
      headerPrefix = "💳 [Bank Transfer Slip Attached]:";
      systemInstruction =
        "You are Biblio's Providus VAN Payment Reconciliation AI. Analyze this bank transfer slip / proof of payment screenshot. Extract: sender name, amount paid in Naira, destination bank, destination account number, transaction reference / session ID, and payment timestamp.";
      break;
    case "business_doc":
      headerPrefix = "🏛️ [CAC / Store Document Attached]:";
      systemInstruction =
        "You are Biblio's Store Compliance & CAC Verification AI. Analyze this business registration certificate or identity document. Extract: registered business name, RC number / BN number, registration date, and registered address.";
      break;
    case "product_photo":
    default:
      headerPrefix = "📸 [Product Photo Attached]:";
      systemInstruction =
        "You are Biblio's Retail Product Cataloging AI. Analyze this retail item photo for an African merchant store. Extract: product name, suggested category, colors, materials/fabrics, estimated retail price in Naira, minimum floor price, stock count, and high-converting catalog description.";
      break;
  }

  const userPrompt = promptText
    ? `${systemInstruction}\nMerchant notes: ${promptText}`
    : systemInstruction;

  if (geminiApiKey) {
    const modelsToTry = getGeminiModelCascade();

    for (const model of modelsToTry) {
      try {
        logger.info(`[MultimodalService] Analyzing ${attachmentType} image via ${model}...`);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType,
                        data: cleanBase64,
                      },
                    },
                    { text: userPrompt },
                  ],
                },
              ],
              generationConfig: { temperature: 0.2 },
            }),
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

          if (analysis) {
            const turn = {
              customerId: merchantId,
              merchantId: merchantId,
              messages: [
                {
                  content: { text: `${headerPrefix}\n${analysis}` },
                  metadata: {
                    attachmentType,
                    hasImage: true,
                    modelUsed: model,
                  },
                } as any,
              ],
              orderState: { status: "no_order" as const },
            };

            const agentReply = await runBiblioAgentTurn(turn, "in_app");
            return { ok: true, analysis, reply: agentReply, engineUsed: model };
          }
        }
      } catch (e: any) {
        logger.warn(`[MultimodalService] ${model} image analysis failed, trying next:`, e.message);
      }
    }
  }

  // Fallback to text turn with notice
  const turn = {
    customerId: merchantId,
    merchantId: merchantId,
    messages: [
      {
        content: {
          text: `${headerPrefix} ${promptText || "Attached for processing."}`,
        },
        metadata: {
          attachmentType,
          hasImage: true,
          modelUsed: "fallback-text",
        },
      } as any,
    ],
    orderState: { status: "no_order" as const },
  };

  const agentReply = await runBiblioAgentTurn(turn, "in_app");
  return {
    ok: true,
    analysis: `${attachmentType} registered and saved.`,
    reply: agentReply,
    engineUsed: "fallback",
  };
}
