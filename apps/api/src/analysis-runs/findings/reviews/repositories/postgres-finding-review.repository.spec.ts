import type { Pool } from 'pg';

import { PostgresFindingReviewRepository } from './postgres-finding-review.repository.js';

describe('PostgresFindingReviewRepository', () => {
  it('upserts one review per finding and clears stale edited fields', async () => {
    const now = new Date();
    const row = {
      id: 'review-id',
      finding_id: 'finding-id',
      status: 'accepted' as const,
      edited_title: null,
      edited_description: null,
      edited_severity: null,
      review_note: 'Verified',
      reviewed_by: null,
      created_at: now,
      updated_at: now,
    };
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new PostgresFindingReviewRepository({
      query,
    } as unknown as Pool);

    await repository.upsert({
      id: row.id,
      findingId: row.finding_id,
      status: row.status,
      editedTitle: null,
      editedDescription: null,
      editedSeverity: null,
      reviewNote: row.review_note,
      reviewedBy: null,
    });

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('ON CONFLICT (finding_id)');
    expect(sql).toContain('edited_title = EXCLUDED.edited_title');
    expect(sql).toContain('updated_at = NOW()');
  });
});
