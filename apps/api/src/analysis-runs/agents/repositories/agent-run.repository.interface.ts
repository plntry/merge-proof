import type { PoolClient } from 'pg';
import type { AgentRun, NewAgentRun } from '../agent-run.types.js';
import type { AgentType } from '../analysis-agent.types.js';

export const AGENT_RUN_REPOSITORY = Symbol('AGENT_RUN_REPOSITORY');

export interface AgentRunRepository {
  findOrCreate(run: NewAgentRun, client?: PoolClient): Promise<AgentRun>;

  findByAnalysisRunAndType(
    analysisRunId: string,
    agentType: AgentType,
  ): Promise<AgentRun | undefined>;

  markRunning(id: string): Promise<AgentRun | undefined>;

  markCompleted(id: string, output: unknown): Promise<AgentRun | undefined>;

  markFailed(id: string, errorMessage: string): Promise<AgentRun | undefined>;
}
