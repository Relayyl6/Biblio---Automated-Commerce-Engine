export interface TranscriptRecord {
  id: string;
  channel: 'whatsapp' | 'instagram' | 'email' | 'livechat' | 'other';
  direction: 'inbound' | 'outbound';
  operatorId: string;
  customerId: string;
  timestamp: string; // ISO 8601
  text: string;
  metadata: Record<string, string>;
}

export interface TranscriptSource {
  list(operatorId?: string, since?: Date): AsyncIterable<TranscriptRecord>;
}
