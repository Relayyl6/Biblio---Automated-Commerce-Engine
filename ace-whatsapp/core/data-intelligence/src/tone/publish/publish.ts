import { ToneGuideCandidate } from '../synth/types.js';
import { EvaluationReport } from '../eval/types.js';
import { ToneGuideStore, ToneGuideVersion } from './types.js';

export interface ApprovalRequest {
  requestId: string;
  candidate: ToneGuideCandidate;
  report: EvaluationReport;
  status: 'pending' | 'approved' | 'rejected';
}

export function requestApproval(candidate: ToneGuideCandidate, report: EvaluationReport): ApprovalRequest {
  if (report.recommendation === 'reject') {
    throw new Error('Cannot request approval for a rejected Tone Guide candidate.');
  }
  // In reality, this would save to an approval_requests table so the UI can render it.
  return {
    requestId: `req_${Date.now()}`,
    candidate,
    report,
    status: 'pending'
  };
}

export async function publishApproved(
  request: ApprovalRequest,
  approverId: string,
  store: ToneGuideStore
): Promise<ToneGuideVersion> {
  if (request.status !== 'approved') {
    throw new Error('Approval request has not been marked as approved.');
  }
  if (request.report.recommendation !== 'promote') {
    throw new Error('Cannot publish a Tone Guide that was not recommended for promotion.');
  }
  if (!approverId) {
    throw new Error('An explicit approver ID is required.');
  }

  const current = await store.current(request.candidate.operatorId);
  const nextVersionNum = current ? current.version + 1 : 1;

  const version: ToneGuideVersion = {
    id: `tgv_${Date.now()}`,
    operatorId: request.candidate.operatorId,
    version: nextVersionNum,
    sections: request.candidate.sections,
    approvedBy: approverId,
    approvedAt: new Date().toISOString(),
    supersedes: current ? current.id : null
  };

  await store.publish(version);
  return version;
}
