export const AGENT_TYPES = [
  'requirements',
  'security',
  'architecture',
  'tests',
] as const;

export type AgentType = (typeof AGENT_TYPES)[number];

export const FINDING_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export type AgentFinding = {
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
};

export type AgentAnalysisResult = {
  findings: AgentFinding[];
};

export type AgentExecutionContext = {
  analysisRunId: string;
  agentRunId: string;
  repository: string;
  pullRequestNumber: number;
};
