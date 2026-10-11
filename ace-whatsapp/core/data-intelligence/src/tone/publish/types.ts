import { ToneGuideCandidate } from '../synth/types.js';

export interface ToneGuideVersion {
  id: string;
  operatorId: string;
  version: number;
  sections: ToneGuideCandidate['sections'];
  approvedBy: string; // human who clicked approve
  approvedAt: string;
  supersedes: string | null;
}

export interface ToneGuideStore {
  current(operatorId: string): Promise<ToneGuideVersion | null>;
  history(operatorId: string): Promise<ToneGuideVersion[]>;
  publish(version: ToneGuideVersion): Promise<void>;
  rollback(operatorId: string, toVersionId: string): Promise<void>;
}
