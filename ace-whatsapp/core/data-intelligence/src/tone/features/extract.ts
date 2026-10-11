import { TranscriptRecord } from '../ingest/types.js';
import { StyleFeatures } from './types.js';
import { tokenizeTurn } from './tokenize.js';

const FORMAL_WORDS = new Set(['therefore', 'however', 'apologies', 'furthermore', 'sincerely', 'regards', 'ensure']);
const INFORMAL_WORDS = new Set(['k', 'ok', 'cool', 'brb', 'lol', 'lmao', 'gonna', 'wanna', 'yeah', 'yep']);
const PIDGIN_MARKERS = new Set(['abeg', 'na', 'wetin', 'shey', 'dey', 'sef', 'o', 'abi', 'sha', 'wahala', 'oya']);
const HEDGING_WORDS = new Set(['maybe', 'perhaps', 'possibly', 'think', 'guess', 'probably', 'might']);
const APOLOGY_WORDS = new Set(['sorry', 'apologies', 'apologize']);
const GRATITUDE_WORDS = new Set(['thanks', 'thank', 'appreciate', 'grateful']);
const CONTRACTIONS = new Set(["don't", "can't", "won't", "isn't", "aren't", "i'm", "it's", "they're", "we're"]);
const EXPANDED_CONTRACTIONS = new Set(["do not", "cannot", "will not", "is not", "are not", "i am", "it is", "they are", "we are"]);

export interface ExtractOpts { minSampleSize?: number; }

export function extractStyleFeatures(records: TranscriptRecord[], opts: ExtractOpts = {}): StyleFeatures {
  const minSampleSize = opts.minSampleSize || 50;
  const operatorId = records.length > 0 ? records[0].operatorId : 'unknown';
  if (records.length === 0) return createEmptyFeatures(operatorId, 0, true);

  let totalTokens = 0, totalSentences = 0, contractionCount = 0, expandedCount = 0;
  let formalCount = 0, informalCount = 0, pidginCount = 0;
  let hedgeCount = 0, apologyCount = 0, gratitudeCount = 0;
  let allCapsCount = 0, heavyPunctuationCount = 0;
  const sentenceLengths: number[] = [];
  const emojiCounts: Record<string, number> = {};

  for (const record of records) {
    const parsed = tokenizeTurn(record.text);
    totalTokens += parsed.tokens.length;
    totalSentences += parsed.sentences.length;
    
    parsed.sentences.forEach(s => {
      sentenceLengths.push(s.split(/\s+/).length);
      // Punctuation edge cases (e.g. "!!!", "??")
      if (/[!?]{2,}/.test(s)) heavyPunctuationCount++;
    });

    parsed.emojis.forEach(e => { emojiCounts[e] = (emojiCounts[e] || 0) + 1; });

    for (let i = 0; i < parsed.tokens.length; i++) {
      const t = parsed.tokens[i];
      if (CONTRACTIONS.has(t)) contractionCount++;
      if (FORMAL_WORDS.has(t)) formalCount++;
      if (INFORMAL_WORDS.has(t)) informalCount++;
      if (PIDGIN_MARKERS.has(t)) pidginCount++;
      if (HEDGING_WORDS.has(t)) hedgeCount++;
      if (APOLOGY_WORDS.has(t)) apologyCount++;
      if (GRATITUDE_WORDS.has(t)) gratitudeCount++;

      if (i < parsed.tokens.length - 1 && EXPANDED_CONTRACTIONS.has(t + " " + parsed.tokens[i+1])) {
        expandedCount++;
      }
    }
    
    // Capitalization edge case
    const words = record.text.split(/\s+/);
    for (const w of words) {
      if (w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w)) allCapsCount++;
    }
  }

  const sampleSize = records.length;
  const avgSentenceLength = sentenceLengths.length ? (sentenceLengths.reduce((a,b) => a+b, 0) / sentenceLengths.length) : 0;
  const emojiTop = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([emoji, count]) => ({ emoji, count }));

  return {
    operatorId,
    sampleSize,
    lowConfidence: sampleSize < minSampleSize,
    avgSentenceLength,
    sentenceLengthStdDev: calculateStdDev(sentenceLengths, avgSentenceLength),
    contractionRate: (contractionCount + expandedCount) > 0 ? (contractionCount / (contractionCount + expandedCount)) : 0,
    emojiRate: totalTokens > 0 ? (Object.values(emojiCounts).reduce((a,b)=>a+b, 0) / totalTokens) * 100 : 0,
    emojiTop,
    formalityScore: (formalCount + informalCount) > 0 ? (formalCount / (formalCount + informalCount)) : 0.5,
    pidginRate: totalTokens > 0 ? (pidginCount / totalTokens) * 100 : 0,
    punctuationIntensity: totalSentences > 0 ? (heavyPunctuationCount / totalSentences) * 100 : 0,
    capitalizationRate: totalTokens > 0 ? (allCapsCount / totalTokens) * 100 : 0,
    hedgingRate: totalTokens > 0 ? (hedgeCount / totalTokens) * 100 : 0,
    directnessScore: 0.5,
    greetingPatterns: [], signoffPatterns: [],
    avgTurnLengthTokens: totalTokens / sampleSize,
    apologyRate: totalTokens > 0 ? (apologyCount / totalTokens) * 100 : 0,
    gratitudeRate: totalTokens > 0 ? (gratitudeCount / totalTokens) * 100 : 0,
    computedAt: new Date().toISOString(),
    version: '1.1.0'
  };
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
}

function createEmptyFeatures(opId: string, size: number, lowConf: boolean): StyleFeatures {
  return {
    operatorId: opId, sampleSize: size, lowConfidence: lowConf, avgSentenceLength: 0, sentenceLengthStdDev: 0, contractionRate: 0,
    emojiRate: 0, emojiTop: [], formalityScore: 0.5, pidginRate: 0, punctuationIntensity: 0, capitalizationRate: 0, hedgingRate: 0,
    directnessScore: 0.5, greetingPatterns: [], signoffPatterns: [], avgTurnLengthTokens: 0, apologyRate: 0, gratitudeRate: 0,
    computedAt: new Date().toISOString(), version: '1.1.0'
  };
}
