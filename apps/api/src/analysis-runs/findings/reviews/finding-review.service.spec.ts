import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import type { Finding } from '../finding.types.js';
import { FindingReviewService } from './finding-review.service.js';

describe('FindingReviewService', () => {
  const finding: Finding = {
    id: 'finding-id',
    analysisRunId: 'analysis-id',
    agentRunId: 'agent-id',
    sourceIndex: 0,
    title: 'Original title',
    description: 'Original description',
    severity: 'high',
    confidence: 0.8,
    createdAt: new Date(),
  };
  let query: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let findById: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let deleteByFindingId: ReturnType<typeof vi.fn>;
  let lockById: ReturnType<typeof vi.fn>;
  let recalculate: ReturnType<typeof vi.fn>;
  let service: FindingReviewService;

  beforeEach(() => {
    query = vi.fn().mockResolvedValue({ rows: [] });
    release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    findById = vi.fn().mockResolvedValue(finding);
    upsert = vi.fn().mockImplementation(async (input) => ({
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    deleteByFindingId = vi.fn().mockResolvedValue(true);
    lockById = vi.fn().mockResolvedValue({ id: finding.analysisRunId });
    recalculate = vi.fn().mockResolvedValue({ decision: 'ready' });
    service = new FindingReviewService(
      { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool,
      { findById } as never,
      { upsert, deleteByFindingId } as never,
      { lockById } as never,
      { recalculate } as never,
    );
  });

  it.each(['accepted', 'rejected'] as const)(
    'stores an %s review without editing the original finding',
    async (status) => {
      const original = structuredClone(finding);
      await service.reviewFinding(finding.id, { status, note: ' verified ' });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          findingId: finding.id,
          status,
          editedTitle: null,
          editedDescription: null,
          editedSeverity: null,
          reviewNote: 'verified',
        }),
        expect.anything(),
      );
      expect(finding).toEqual(original);
      expect(recalculate).toHaveBeenCalledWith(
        finding.analysisRunId,
        expect.anything(),
      );
      expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    },
  );

  it('stores trimmed edited content and supports upsert updates', async () => {
    const dto = {
      status: 'edited' as const,
      editedFinding: {
        title: ' Authorization bypass ',
        description: ' Boundary is bypassed. ',
        severity: 'critical' as const,
      },
    };
    await service.reviewFinding(finding.id, dto);
    await service.reviewFinding(finding.id, dto);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        editedTitle: 'Authorization bypass',
        editedDescription: 'Boundary is bypassed.',
        editedSeverity: 'critical',
      }),
      expect.anything(),
    );
  });

  it('resets a review and recalculates in the same transaction', async () => {
    await service.resetReview(finding.id);
    expect(deleteByFindingId).toHaveBeenCalledWith(
      finding.id,
      expect.anything(),
    );
    expect(recalculate).toHaveBeenCalledWith(
      finding.analysisRunId,
      expect.anything(),
    );
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
  });

  it('rejects missing edited data before opening a transaction', async () => {
    await expect(
      service.reviewFinding(finding.id, { status: 'edited' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects edited data for accept and reject states', async () => {
    await expect(
      service.reviewFinding(finding.id, {
        status: 'accepted',
        editedFinding: {
          title: 'x',
          description: 'y',
          severity: 'low',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found and rolls back for an unknown finding', async () => {
    findById.mockResolvedValue(undefined);
    await expect(
      service.reviewFinding('unknown', { status: 'accepted' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
    expect(recalculate).not.toHaveBeenCalled();
  });
});
