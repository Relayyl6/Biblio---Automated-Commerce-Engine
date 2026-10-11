export interface LedgerEntry {
  id: string;
  amount: number;
  currency: string;
  timestamp: string;
  reference: string | null;
  senderName: string | null;
  accountLast4: string | null;
}

export interface LedgerClient {
  findCandidates(q: {
    amount: number;
    currency: string;
    windowStart: string;
    windowEnd: string;
    reference?: string;
    accountLast4?: string;
  }): Promise<LedgerEntry[]>;
}

export interface ReconciliationResult {
  receiptId: string;
  status: 'matched' | 'ambiguous' | 'not_found' | 'rejected_low_confidence';
  matchedEntry: LedgerEntry | null;
  candidates: LedgerEntry[];
  reasons: string[];
  reconciledAt: string;
}
