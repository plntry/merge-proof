import type {
  AgentAnalysisResult,
  AgentExecutionContext,
  AgentType,
} from './analysis-agent.types.js';

export const ANALYSIS_AGENTS = Symbol('ANALYSIS_AGENTS');

export interface AnalysisAgent {
  readonly type: AgentType;
  readonly promptVersion: string;
  run(context: AgentExecutionContext): Promise<AgentAnalysisResult>;
}
