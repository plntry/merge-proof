import type { PoolClient } from 'pg';
import type {
  Finding,
  FindingWithAgentType,
  NewFinding,
} from '../finding.types.js';

export const FINDING_REPOSITORY = Symbol('FINDING_REPOSITORY');

export interface FindingRepository {
  preserveForAgentRun(
    agentRunId: string,
    findings: NewFinding[],
  ): Promise<Finding[]>;

  findById(id: string, client?: PoolClient): Promise<Finding | undefined>;

  findByAnalysisRunId(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<Finding[]>;

  findByAnalysisRunIdWithAgentType(
    analysisRunId: string,
    client?: PoolClient,
  ): Promise<FindingWithAgentType[]>;
}
