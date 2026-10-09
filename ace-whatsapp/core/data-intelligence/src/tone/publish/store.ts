import { ToneGuideVersion, ToneGuideStore } from './types.js';
import { sql } from '@ace/shared/clients.js';

export class PostgresToneGuideStore implements ToneGuideStore {
  async current(operatorId: string): Promise<ToneGuideVersion | null> {
    const rows = await sql<any[]>`
      SELECT id, version, sections, approved_by, approved_at, supersedes
      FROM tone_guides
      WHERE operator_id = ${operatorId} AND is_active = true
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return this.mapRow(operatorId, rows[0]);
  }

  async history(operatorId: string): Promise<ToneGuideVersion[]> {
    const rows = await sql<any[]>`
      SELECT id, version, sections, approved_by, approved_at, supersedes
      FROM tone_guides
      WHERE operator_id = ${operatorId}
      ORDER BY version DESC
    `;
    return rows.map(r => this.mapRow(operatorId, r));
  }

  async publish(version: ToneGuideVersion): Promise<void> {
    // Immutable transaction
    await sql.begin(async (tx) => {
      // Deactivate old
      await tx`UPDATE tone_guides SET is_active = false WHERE operator_id = ${version.operatorId}`;
      // Insert new
      await tx`
        INSERT INTO tone_guides (id, operator_id, version, sections, approved_by, approved_at, supersedes, is_active)
        VALUES (${version.id}, ${version.operatorId}, ${version.version}, ${sql.json(version.sections)}, ${version.approvedBy}, ${version.approvedAt}, ${version.supersedes}, true)
      `;
      
      // Sync to the merchants table so agentLoop.ts can pick it up immediately
      await tx`
        UPDATE merchants 
        SET tone_guide = ${JSON.stringify(version.sections)}
        WHERE id = ${version.operatorId}
      `;
    });
  }

  async rollback(operatorId: string, toVersionId: string): Promise<void> {
    await sql.begin(async (tx) => {
      await tx`UPDATE tone_guides SET is_active = false WHERE operator_id = ${operatorId}`;
      await tx`UPDATE tone_guides SET is_active = true WHERE id = ${toVersionId}`;
      
      const rows = await tx<any[]>`SELECT sections FROM tone_guides WHERE id = ${toVersionId}`;
      if (rows.length > 0) {
        await tx`UPDATE merchants SET tone_guide = ${JSON.stringify(rows[0].sections)} WHERE id = ${operatorId}`;
      }
    });
  }

  private mapRow(operatorId: string, row: any): ToneGuideVersion {
    return {
      id: row.id,
      operatorId,
      version: row.version,
      sections: row.sections,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      supersedes: row.supersedes
    };
  }
}
