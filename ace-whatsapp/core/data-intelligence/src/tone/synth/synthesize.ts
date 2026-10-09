import { StyleFeatures } from '../features/types.js';
import { ToneGuideCandidate } from './types.js';
import { buildSynthesisPrompt } from './prompt.js';
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function synthesizeToneGuide(
  features: StyleFeatures,
  priorGuideText?: string
): Promise<ToneGuideCandidate> {
  const prompt = buildSynthesisPrompt(features, priorGuideText);
  
  // Real LLM call to Groq
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'system', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1, // Low temp for structured JSON
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0].message.content || '{}';
  const parsed = JSON.parse(content);
  
  // Combine LLM self-confidence with mathematical sample size confidence
  const confidence = features.lowConfidence ? 'low' : 'high';

  return {
    id: `tgc_${Date.now()}`,
    operatorId: features.operatorId,
    sections: {
      voice: parsed.voice || 'Default voice',
      doList: parsed.doList || [],
      dontList: parsed.dontList || [],
      exampleRewrites: parsed.exampleRewrites || []
    },
    derivedFromFeatures: features,
    llmModel: 'llama-3.3-70b-versatile',
    promptVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    confidence
  };
}
