import { StyleFeatures } from '../features/types.js';

export function calculateCosineSimilarity(f1: StyleFeatures, f2: StyleFeatures): number {
  const v1 = vectorize(f1);
  const v2 = vectorize(f2);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    norm1 += v1[i] * v1[i];
    norm2 += v2[i] * v2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

function vectorize(f: StyleFeatures): number[] {
  // Normalize fields that have vastly different scales
  return [
    f.avgSentenceLength / 20, // rough normalization
    f.contractionRate,
    f.emojiRate / 100,
    f.formalityScore,
    f.pidginRate / 100,
    f.punctuationIntensity / 100,
    f.capitalizationRate / 100
  ];
}
