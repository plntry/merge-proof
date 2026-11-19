import { AGENT_TYPES } from '../agents/analysis-agent.types.js';
import type { EffectiveFinding } from '../findings/effective/effective-finding.types.js';
import {
  BLOCK_SCORE_THRESHOLD,
  CRITICAL_AUTO_BLOCK_CONFIDENCE,
  HIGH_REVIEW_CONFIDENCE,
  REVIEW_SCORE_THRESHOLD,
  SEVERITY_WEIGHTS,
} from './merge-decision.constants.js';
import type {
  AgentCoverage,
  MergeAssessmentSummary,
  MergeDecisionInput,
  MergeDecisionReason,
  MergeDecisionResult,
} from './merge-decision.types.js';

export class MergeDecisionEngine {
  evaluate(input: MergeDecisionInput): MergeDecisionResult {
    const coverage = this.normalizeCoverage(input.agentCoverage);
    const activeFindings = input.findings.filter(
      (finding) => !finding.excluded,
    );
    const rawRisk = input.findings.reduce(
      (sum, finding) => sum + this.riskContribution(finding),
      0,
    );
    const riskScore = Math.round(Math.min(100, Math.max(0, rawRisk)));
    const summary = this.summarize(input.findings, coverage);
    const blockingReasons = this.blockingReasons(activeFindings, riskScore);

    if (blockingReasons.length > 0) {
      return {
        decision: 'blocked',
        riskScore,
        reasons: blockingReasons,
        summary,
      };
    }

    const reviewReasons = this.reviewReasons(
      activeFindings,
      coverage,
      riskScore,
    );

    if (reviewReasons.length > 0) {
      return {
        decision: 'needs_review',
        riskScore,
        reasons: reviewReasons,
        summary,
      };
    }

    return { decision: 'ready', riskScore, reasons: [], summary };
  }

  private riskContribution(finding: EffectiveFinding): number {
    if (finding.excluded) return 0;
    const weight = SEVERITY_WEIGHTS[finding.severity];
    return finding.humanVerified ? weight : weight * finding.originalConfidence;
  }

  private normalizeCoverage(coverage: AgentCoverage[]): AgentCoverage[] {
    const byAgent = new Map(
      coverage.map((item) => [item.agentType, item.status]),
    );
    return AGENT_TYPES.map((agentType) => ({
      agentType,
      status: byAgent.get(agentType) === 'completed' ? 'completed' : 'failed',
    }));
  }

  private blockingReasons(
    findings: EffectiveFinding[],
    riskScore: number,
  ): MergeDecisionReason[] {
    const reasons: MergeDecisionReason[] = [];

    for (const finding of findings) {
      if (
        finding.severity === 'critical' &&
        (finding.reviewStatus === 'accepted' ||
          finding.reviewStatus === 'edited')
      ) {
        reasons.push({
          code: 'HUMAN_CONFIRMED_CRITICAL_FINDING',
          findingId: finding.findingId,
          agentType: finding.agentType,
          message: `A human-confirmed critical ${finding.agentType} finding blocks merging.`,
        });
      } else if (
        finding.severity === 'critical' &&
        finding.reviewStatus === 'unreviewed' &&
        finding.originalConfidence >= CRITICAL_AUTO_BLOCK_CONFIDENCE
      ) {
        reasons.push({
          code: 'HIGH_CONFIDENCE_CRITICAL_FINDING',
          findingId: finding.findingId,
          agentType: finding.agentType,
          message: `An unreviewed critical ${finding.agentType} finding meets the automatic block confidence threshold.`,
        });
      }
    }

    if (riskScore >= BLOCK_SCORE_THRESHOLD) {
      reasons.push({
        code: 'RISK_SCORE_BLOCK_THRESHOLD',
        message: `Risk score ${riskScore} meets the block threshold of ${BLOCK_SCORE_THRESHOLD}.`,
      });
    }

    return reasons;
  }

  private reviewReasons(
    findings: EffectiveFinding[],
    coverage: AgentCoverage[],
    riskScore: number,
  ): MergeDecisionReason[] {
    const reasons: MergeDecisionReason[] = [];

    for (const item of coverage) {
      if (item.status === 'failed') {
        reasons.push({
          code: 'INCOMPLETE_AGENT_COVERAGE',
          agentType: item.agentType,
          message: `The required ${item.agentType} analysis did not complete.`,
        });
      }
    }

    for (const finding of findings) {
      if (
        finding.reviewStatus === 'unreviewed' &&
        finding.severity === 'critical'
      ) {
        reasons.push({
          code: 'UNREVIEWED_CRITICAL_FINDING',
          findingId: finding.findingId,
          agentType: finding.agentType,
          message: `An unreviewed critical ${finding.agentType} finding requires human review.`,
        });
      } else if (
        finding.reviewStatus === 'unreviewed' &&
        finding.severity === 'high' &&
        finding.originalConfidence >= HIGH_REVIEW_CONFIDENCE
      ) {
        reasons.push({
          code: 'HIGH_CONFIDENCE_HIGH_FINDING',
          findingId: finding.findingId,
          agentType: finding.agentType,
          message: `An unreviewed high-severity ${finding.agentType} finding meets the human-review confidence threshold.`,
        });
      }
    }

    if (riskScore >= REVIEW_SCORE_THRESHOLD) {
      reasons.push({
        code: 'RISK_SCORE_REVIEW_THRESHOLD',
        message: `Risk score ${riskScore} meets the review threshold of ${REVIEW_SCORE_THRESHOLD}.`,
      });
    }

    return reasons;
  }

  private summarize(
    findings: EffectiveFinding[],
    coverage: AgentCoverage[],
  ): MergeAssessmentSummary {
    const active = findings.filter((finding) => !finding.excluded);
    return {
      totalFindings: findings.length,
      activeFindings: active.length,
      rejectedFindings: findings.length - active.length,
      low: active.filter((finding) => finding.severity === 'low').length,
      medium: active.filter((finding) => finding.severity === 'medium').length,
      high: active.filter((finding) => finding.severity === 'high').length,
      critical: active.filter((finding) => finding.severity === 'critical')
        .length,
      reviewedFindings: findings.filter(
        (finding) => finding.reviewStatus !== 'unreviewed',
      ).length,
      unreviewedFindings: findings.filter(
        (finding) => finding.reviewStatus === 'unreviewed',
      ).length,
      completedAgents: coverage.filter((item) => item.status === 'completed')
        .length,
      failedAgents: coverage.filter((item) => item.status === 'failed').length,
    };
  }
}
