export interface StyleFeatures {
  operatorId: string;
  sampleSize: number;
  lowConfidence?: boolean;
  
  // Lexical
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  contractionRate: number;
  emojiRate: number;
  emojiTop: Array<{ emoji: string; count: number }>;
  
  // Register & Cultural Edge Cases
  formalityScore: number;
  hedgingRate: number;
  directnessScore: number;
  pidginRate: number;             // Frequency of Nigerian pidgin/slang markers
  punctuationIntensity: number;   // Excessive ? or ! usage
  capitalizationRate: number;     // All caps usage
  
  // Structural
  greetingPatterns: string[];     
  signoffPatterns: string[];
  avgTurnLengthTokens: number;
  
  // Pragmatic
  apologyRate: number;
  gratitudeRate: number;
  
  computedAt: string;
  version: string;
}
