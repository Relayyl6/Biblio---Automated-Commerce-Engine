import { ToneGuideCandidate } from '../synth/types.js';
import { EvaluationReport } from '../eval/types.js';
import { ApprovalRequest } from './publish.js';

export function requestApproval(candidate: ToneGuideCandidate, report: EvaluationReport): ApprovalRequest {
  if (report.recommendation === 'reject') {
    throw new Error('Cannot request approval for a rejected Tone Guide candidate.');
  }
  return {
    requestId: `req_${Date.now()}`,
    candidate,
    report,
    status: 'pending'
  };
}
