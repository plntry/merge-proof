import type { AgentType } from '../agents/analysis-agent.types.js';
import type { EffectiveFinding } from '../findings/effective/effective-finding.types.js';
import { MergeDecisionEngine } from './merge-decision-engine.js';

const agentCoverage = (
  failed?: AgentType,
): { agentType: AgentType; status: 'completed' | 'failed' }[] =>
  (['requirements', 'security', 'architecture', 'tests'] as const).map(
    (agentType) => ({
      agentType,
      status: agentType === failed ? 'failed' : 'completed',
    }),
  );

function finding(overrides: Partial<EffectiveFinding> = {}): EffectiveFinding {
  return {
    findingId: 'finding-id',
    agentType: 'security',
    title: 'Potential issue',
    description: 'Repository evidence.',
    severity: 'low',
    originalConfidence: 0.5,
    reviewStatus: 'unreviewed',
    humanVerified: false,
    excluded: false,
    ...overrides,
  };
}

describe('MergeDecisionEngine', () => {
  const engine = new MergeDecisionEngine();

  it('returns ready for complete coverage with no findings', () => {
    expect(
      engine.evaluate({ findings: [], agentCoverage: agentCoverage() }),
    ).toMatchObject({ decision: 'ready', riskScore: 0, reasons: [] });
  });

  it('returns ready for low risk findings and rounds the final score', () => {
    expect(
      engine.evaluate({
        findings: [finding({ originalConfidence: 0.7 })],
        agentCoverage: agentCoverage(),
      }),
    ).toMatchObject({ decision: 'ready', riskScore: 4 });
  });

  it('requires review for a high-confidence unreviewed high finding', () => {
    const result = engine.evaluate({
      findings: [finding({ severity: 'high', originalConfidence: 0.6 })],
      agentCoverage: agentCoverage(),
    });
    expect(result.decision).toBe('needs_review');
    expect(result.reasons.map(({ code }) => code)).toContain(
      'HIGH_CONFIDENCE_HIGH_FINDING',
    );
  });

  it('blocks a critical finding at the automatic confidence threshold', () => {
    const result = engine.evaluate({
      findings: [finding({ severity: 'critical', originalConfidence: 0.9 })],
      agentCoverage: agentCoverage(),
    });
    expect(result.decision).toBe('blocked');
    expect(result.reasons.map(({ code }) => code)).toContain(
      'HIGH_CONFIDENCE_CRITICAL_FINDING',
    );
  });

  it('requires review for a lower-confidence unreviewed critical finding', () => {
    const result = engine.evaluate({
      findings: [finding({ severity: 'critical', originalConfidence: 0.5 })],
      agentCoverage: agentCoverage(),
    });
    expect(result.decision).toBe('needs_review');
    expect(result.reasons.map(({ code }) => code)).toContain(
      'UNREVIEWED_CRITICAL_FINDING',
    );
  });

  it('blocks at the aggregate risk threshold and clamps at 100', () => {
    const findings = [0, 1, 2].map((index) =>
      finding({
        findingId: `finding-${index}`,
        severity: 'high',
        originalConfidence: 1,
      }),
    );
    expect(
      engine.evaluate({ findings, agentCoverage: agentCoverage() }),
    ).toMatchObject({ decision: 'blocked', riskScore: 90 });
  });

  it('requires review at the aggregate review threshold', () => {
    const findings = [0, 1].map((index) =>
      finding({
        findingId: `finding-${index}`,
        severity: 'medium',
        originalConfidence: 1,
      }),
    );
    const result = engine.evaluate({
      findings,
      agentCoverage: agentCoverage(),
    });
    expect(result.decision).toBe('needs_review');
    expect(result.riskScore).toBe(30);
    expect(result.reasons.map(({ code }) => code)).toContain(
      'RISK_SCORE_REVIEW_THRESHOLD',
    );
  });

  it('prevents ready when a required agent failed', () => {
    const result = engine.evaluate({
      findings: [],
      agentCoverage: agentCoverage('security'),
    });
    expect(result.decision).toBe('needs_review');
    expect(result.reasons).toContainEqual(
      expect.objectContaining({
        code: 'INCOMPLETE_AGENT_COVERAGE',
        agentType: 'security',
      }),
    );
  });

  it('excludes a human-rejected critical finding', () => {
    const result = engine.evaluate({
      findings: [
        finding({
          severity: 'critical',
          originalConfidence: 1,
          reviewStatus: 'rejected',
          excluded: true,
        }),
      ],
      agentCoverage: agentCoverage(),
    });
    expect(result).toMatchObject({
      decision: 'ready',
      riskScore: 0,
      summary: { activeFindings: 0, rejectedFindings: 1 },
    });
  });

  it('blocks a human-accepted critical finding at full weight', () => {
    const result = engine.evaluate({
      findings: [
        finding({
          severity: 'critical',
          originalConfidence: 0.1,
          reviewStatus: 'accepted',
          humanVerified: true,
        }),
      ],
      agentCoverage: agentCoverage(),
    });
    expect(result).toMatchObject({ decision: 'blocked', riskScore: 50 });
  });

  it('blocks when a human edit escalates a finding to critical', () => {
    const result = engine.evaluate({
      findings: [
        finding({
          severity: 'critical',
          originalConfidence: 0.1,
          reviewStatus: 'edited',
          humanVerified: true,
        }),
      ],
      agentCoverage: agentCoverage(),
    });
    expect(result.decision).toBe('blocked');
  });

  it('uses a downgraded human-edited severity at full weight', () => {
    const result = engine.evaluate({
      findings: [
        finding({
          severity: 'low',
          originalConfidence: 1,
          reviewStatus: 'edited',
          humanVerified: true,
        }),
      ],
      agentCoverage: agentCoverage(),
    });
    expect(result).toMatchObject({ decision: 'ready', riskScore: 5 });
  });
});
