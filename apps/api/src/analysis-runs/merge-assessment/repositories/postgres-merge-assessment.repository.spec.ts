import type { Pool } from 'pg';

import { PostgresMergeAssessmentRepository } from './postgres-merge-assessment.repository.js';

describe('PostgresMergeAssessmentRepository', () => {
  it('upserts one current assessment per analysis run', async () => {
    const row = {
      id: 'assessment-id',
      analysis_run_id: 'analysis-id',
      decision: 'ready' as const,
      risk_score: 0,
      reasons: [],
      summary: {
        totalFindings: 0,
        activeFindings: 0,
        rejectedFindings: 0,
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
        reviewedFindings: 0,
        unreviewedFindings: 0,
        completedAgents: 4,
        failedAgents: 0,
      },
      created_at: new Date(),
      updated_at: new Date(),
    };
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new PostgresMergeAssessmentRepository({
      query,
    } as unknown as Pool);

    await repository.upsert({
      id: 'new-id',
      analysisRunId: 'analysis-id',
      decision: row.decision,
      riskScore: row.risk_score,
      reasons: row.reasons,
      summary: row.summary,
    });

    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (analysis_run_id)');
    expect(query.mock.calls[0][0]).toContain('DO UPDATE SET');
  });
});
