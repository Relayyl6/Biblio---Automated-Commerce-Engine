import { sql } from '@ace/shared/clients.js';
import { TranscriptRecord, TranscriptSource } from './types.js';

export class PostgresTranscriptSource implements TranscriptSource {
  async *list(operatorId?: string, since?: Date): AsyncIterable<TranscriptRecord> {
    const limit = 500;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // We only care about human_operator messages to learn the merchant's tone
      const rows = await sql<any[]>`
        SELECT id, merchant_id, customer_id, content, created_at
        FROM conversation_messages
        WHERE source = 'human_operator'
          ${operatorId ? sql`AND merchant_id = ${operatorId}` : sql``}
          ${since ? sql`AND created_at >= ${since}` : sql``}
        ORDER BY created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        yield {
          id: row.id,
          channel: 'whatsapp',
          direction: 'outbound',
          operatorId: row.merchant_id,
          customerId: row.customer_id,
          timestamp: row.created_at.toISOString(),
          text: row.content,
          metadata: {}
        };
      }

      offset += limit;
    }
  }
}
