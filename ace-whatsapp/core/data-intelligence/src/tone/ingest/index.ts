import { TranscriptRecord, TranscriptSource } from './types.js';
import { redact } from './redact.js';

export interface IngestOptions {
  operatorId?: string;
  since?: Date;
}

/**
 * Streams transcripts from the source, redacts PII, and returns the clean array.
 */
export async function ingestTranscripts(
  source: TranscriptSource,
  opts: IngestOptions = {}
): Promise<TranscriptRecord[]> {
  const records: TranscriptRecord[] = [];

  for await (const raw of source.list(opts.operatorId, opts.since)) {
    // Clone and redact
    records.push({
      ...raw,
      text: redact(raw.text),
    });
  }

  return records;
}
