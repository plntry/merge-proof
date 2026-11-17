import type { PoolClient } from 'pg';
import type { Finding, NewFinding } from '../finding.types.js';

export const FINDING_REPOSITORY = Symbol('FINDING_REPOSITORY');

export interface FindingRepository {
  replaceForAgentRun(
    agentRunId: string,
    findings: NewFinding[],
  ): Promise<Finding[]>;

  findByAnalysisRunId(analysisRunId: string): Promise<Finding[]>;
}
