import type { PoolClient } from 'pg';
import type { AgentRun, NewAgentRun } from '../agent-run.types.js';

export const AGENT_RUN_REPOSITORY = Symbol('AGENT_RUN_REPOSITORY');

export interface AgentRunRepository {
  save(run: NewAgentRun, client?: PoolClient): Promise<AgentRun>;

  findByAnalysisRunAndType(
    analysisRunId: string,
    agentType: string,
  ): Promise<AgentRun | undefined>;

  markRunning(id: string): Promise<AgentRun | undefined>;

  markCompleted(id: string, output: unknown): Promise<AgentRun | undefined>;

  markFailed(id: string, errorMessage: string): Promise<AgentRun | undefined>;
}
