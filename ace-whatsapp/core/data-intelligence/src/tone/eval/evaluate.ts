import { StyleFeatures } from '../features/types.js';
import { ToneGuideCandidate } from '../synth/types.js';
import { EvaluationReport } from './types.js';
import { calculateCosineSimilarity } from './similarity.js';
import Groq from 'groq-sdk';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function evaluateCandidate(
  candidate: ToneGuideCandidate,
  baselineFeatures?: StyleFeatures
): Promise<EvaluationReport> {
  let styleSimilarity = 1.0;
  let regressionRisk: 'low' | 'medium' | 'high' = 'low';
  let recommendation: 'promote' | 'hold' | 'reject' = 'promote';
  let humanPreference: number | undefined = undefined;

  if (baselineFeatures) {
    styleSimilarity = calculateCosineSimilarity(candidate.derivedFromFeatures, baselineFeatures);
    
    // If the math score drops below 0.85, OR sample size was low, we fallback to LLM judgment.
    if (styleSimilarity < 0.85 || candidate.confidence === 'low') {
      regressionRisk = 'medium';
      const score = await getLlmEducatedEvaluation(candidate, baselineFeatures);
      humanPreference = score;
      
      if (score < 0.5) {
        recommendation = 'reject';
        regressionRisk = 'high';
      } else if (score < 0.8) {
        recommendation = 'hold'; // Requires deeper human review
      } else {
        recommendation = 'promote';
        regressionRisk = 'low';
      }
    }
  } else {
    // No baseline (first time generation)
    if (candidate.confidence === 'low') {
      recommendation = 'hold';
      regressionRisk = 'medium';
    }
  }

  return {
    candidateId: candidate.id,
    metrics: { styleSimilarity, humanPreference, regressionRisk },
    failingExamples: [],
    recommendation,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Uses an LLM to evaluate the generated Tone Guide against the old math baseline 
 * when the deterministic math isn't confident enough.
 */
async function getLlmEducatedEvaluation(candidate: ToneGuideCandidate, baseline: StyleFeatures): Promise<number> {
  const prompt = `
You are an expert Tone Guide Evaluator.
The old baseline features were: ${JSON.stringify(baseline)}
The new Candidate Guide is: ${JSON.stringify(candidate.sections)}

Rate from 0.0 to 1.0 how well the new Candidate captures the essence of the baseline features.
Return ONLY a JSON object: { "score": 0.85 }
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      response_format: { type: 'json_object' }
    });
    const parsed = JSON.parse(completion.choices[0].message.content || '{"score":0}');
    return parsed.score || 0;
  } catch (e) {
    return 0; // Safe fallback on LLM failure
  }
}
