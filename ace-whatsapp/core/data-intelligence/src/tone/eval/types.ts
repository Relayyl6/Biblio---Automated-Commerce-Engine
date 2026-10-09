export interface EvaluationReport {
  candidateId: string;
  baselineGuideId?: string;
  metrics: {
    styleSimilarity: number;      // 0..1, cosine over StyleFeatures
    humanPreference?: number;     // optional, from LLM pairwise judge if math is ambiguous
    regressionRisk: 'low' | 'medium' | 'high';
  };
  failingExamples: Array<{ transcript: string; issue: string }>;
  recommendation: 'promote' | 'hold' | 'reject';
  evaluatedAt: string;
}
