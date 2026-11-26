export type AnalysisStatus = "pending" | "running" | "completed" | "failed" | "needs_review";
export type AgentType = "requirements" | "security" | "architecture" | "tests";
export type Decision = "ready" | "needs_review" | "blocked";
export type Severity = "low" | "medium" | "high" | "critical";

export type Finding = {
  id: string;
  agentType: AgentType;
  original: { title: string; description: string; severity: Severity; confidence: number };
  review: null | { status: "accepted" | "rejected" | "edited"; note: string | null; editedFinding: null | { title: string; description: string; severity: Severity } };
  effective: { title: string; description: string; severity: Severity; humanVerified: boolean; excluded: boolean };
};

export type Assessment = {
  analysisRunId: string;
  decision: Decision;
  riskScore: number;
  reasons: Array<{ code: string; message: string; findingId?: string; agentType?: AgentType }>;
  summary: { totalFindings: number; activeFindings: number; rejectedFindings: number };
};

export type Trace = {
  summary: {
    totalDurationMs: number | null;
    attempts: number;
    retries: number;
    agents: Array<{ agentType: AgentType; status: string; model: string; promptVersion: string | null; reused: boolean; durationMs: number | null }>;
    totals: { executedAgents: number; reusedAgents: number; failedAgents: number; modelCalls: number; toolCalls: number; findings: number; usageComplete: boolean; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
  };
  events: Array<{ eventType: string; createdAt: string; metadata: Record<string, unknown> }>;
};

export type LiveSnapshot = {
  analysisRun: { id: string; status: AnalysisStatus; attemptCount: number };
  agents: Array<{ type: AgentType; status: "waiting" | "pending" | "running" | "completed" | "failed" }>;
  assessment: { decision: Decision; riskScore: number } | null;
  findingCount: number;
  updatedAt: string;
};
