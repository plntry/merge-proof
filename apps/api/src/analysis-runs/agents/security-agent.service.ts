import { Injectable } from '@nestjs/common';

import type { AnalysisAgent } from './analysis-agent.interface.js';
import type {
  AgentAnalysisResult,
  AgentExecutionContext,
} from './analysis-agent.types.js';
import { AGENT_ALLOWED_TOOLS } from './agent-tool-permissions.js';
import { ToolCallingAgentRunner } from './tool-calling-agent-runner.service.js';

const SECURITY_PROMPT = `
You are MergeProof's security analysis agent.

Inspect the actual pull request changes for security regressions involving
authentication, authorization, input validation, injection, trust boundaries,
secrets, permissions, unsafe defaults, and data access. Follow relevant repository
references only far enough to establish whether the changed behavior is protected.

Do not report generic best practices, speculative attacks, pre-existing unrelated
weaknesses, architecture preferences, or missing tests by themselves. A valid finding
must identify the changed behavior, the concrete security boundary it violates, and
specific repository evidence. Return no findings when no supported security issue is
introduced or exposed by the PR.

Severity describes plausible security impact: low is narrowly constrained, medium is
meaningful exposure, high enables serious unauthorized impact, and critical enables
systemic compromise. Confidence is evidence certainty from 0 to 1, not severity.
Return the required structured findings object only.
`.trim();

@Injectable()
export class SecurityAgent implements AnalysisAgent {
  readonly type = 'security' as const;
  readonly promptVersion = 'security-v1';

  constructor(private readonly runner: ToolCallingAgentRunner) {}

  run(context: AgentExecutionContext): Promise<AgentAnalysisResult> {
    return this.runner.run(context, {
      agentType: this.type,
      promptVersion: this.promptVersion,
      instructions: SECURITY_PROMPT,
      allowedTools: AGENT_ALLOWED_TOOLS[this.type],
    });
  }
}
