import { StyleFeatures } from '../features/types.js';

export interface ToneGuideCandidate {
  id: string;
  operatorId: string;
  baseToneGuideId?: string;
  sections: {
    voice: string;
    doList: string[];
    dontList: string[];
    exampleRewrites: Array<{ original: string; rewritten: string; reason: string }>;
  };
  derivedFromFeatures: StyleFeatures;
  llmModel: string;
  promptVersion: string;
  generatedAt: string;
  confidence: 'low' | 'medium' | 'high';
}
