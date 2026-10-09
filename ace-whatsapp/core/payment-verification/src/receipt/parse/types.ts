export interface StructuredReceipt {
  receiptId: string;
  fields: {
    amount: { value: number; currency: string; confidence: number } | null;
    timestamp: { value: string; confidence: number } | null;
    reference: { value: string; confidence: number } | null;
    senderName: { value: string; confidence: number } | null;
    receiverName: { value: string; confidence: number } | null;
    bankName: { value: string; confidence: number } | null;
    accountLast4: { value: string; confidence: number } | null;
  };
  ambiguities: Array<{ field: string; reason: string; candidates: string[] }>;
  parsedAt: string;
  parserVersion: string;
}
