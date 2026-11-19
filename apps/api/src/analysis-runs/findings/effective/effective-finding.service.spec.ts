import type { FindingWithAgentType } from '../finding.types.js';
import type { FindingReview } from '../reviews/finding-review.types.js';
import { EffectiveFindingService } from './effective-finding.service.js';

const finding: FindingWithAgentType = {
  id: 'finding-id',
  analysisRunId: 'analysis-id',
  agentRunId: 'agent-id',
  sourceIndex: 0,
  agentType: 'security',
  title: 'AI title',
  description: 'AI description',
  severity: 'high',
  confidence: 0.81,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function review(overrides: Partial<FindingReview> = {}): FindingReview {
  return {
    id: 'review-id',
    findingId: finding.id,
    status: 'accepted',
    editedTitle: null,
    editedDescription: null,
    editedSeverity: null,
    reviewNote: null,
    reviewedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('EffectiveFindingService', () => {
  const service = new EffectiveFindingService({} as never, {} as never);

  it('uses original content and provenance for an unreviewed finding', () => {
    expect(service.resolve(finding)).toEqual({
      findingId: finding.id,
      agentType: 'security',
      title: 'AI title',
      description: 'AI description',
      severity: 'high',
      originalConfidence: 0.81,
      reviewStatus: 'unreviewed',
      humanVerified: false,
      excluded: false,
    });
  });

  it('marks an accepted original finding human verified', () => {
    expect(service.resolve(finding, review())).toMatchObject({
      title: 'AI title',
      severity: 'high',
      originalConfidence: 0.81,
      humanVerified: true,
      excluded: false,
    });
  });

  it('excludes a rejected finding without removing original content', () => {
    expect(
      service.resolve(finding, review({ status: 'rejected' })),
    ).toMatchObject({
      title: 'AI title',
      severity: 'high',
      reviewStatus: 'rejected',
      humanVerified: false,
      excluded: true,
    });
  });

  it('uses human-edited content while retaining original confidence', () => {
    expect(
      service.resolve(
        finding,
        review({
          status: 'edited',
          editedTitle: 'Human title',
          editedDescription: 'Human description',
          editedSeverity: 'critical',
        }),
      ),
    ).toMatchObject({
      agentType: 'security',
      title: 'Human title',
      description: 'Human description',
      severity: 'critical',
      originalConfidence: 0.81,
      humanVerified: true,
      excluded: false,
    });
  });
});
