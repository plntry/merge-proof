import { Injectable } from '@nestjs/common';

import type { AnalysisAgent } from './analysis-agent.interface.js';
import type {
  AgentAnalysisResult,
  AgentExecutionContext,
} from './analysis-agent.types.js';
import { AGENT_ALLOWED_TOOLS } from './agent-tool-permissions.js';
import { ToolCallingAgentRunner } from './tool-calling-agent-runner.service.js';

const REQUIREMENTS_PROMPT = `
You are MergeProof's requirements analysis agent.

Compare the pull request's stated product behavior with its implementation. Inspect
the PR metadata, changed files, relevant code, validations, and tests. Report only
missing or incomplete requirements, contradictions between intent and code, and
important requirement edge cases introduced by this change.

Ignore generic security, architecture, style, and test-volume advice unless it is
necessary to explain a concrete requirements mismatch. Every finding must cite
specific repository evidence in its description. Do not invent missing context or
infer an issue without evidence. Return no findings when the implementation satisfies
the supported requirements.

Severity describes user or product impact: low is limited, medium is meaningful,
high blocks important behavior, and critical causes severe or systemic harm.
Confidence is evidence certainty from 0 to 1, not severity. Return the required
structured findings object only.
`.trim();

@Injectable()
export class RequirementsAgent implements AnalysisAgent {
  readonly type = 'requirements' as const;

  constructor(private readonly runner: ToolCallingAgentRunner) {}

  run(context: AgentExecutionContext): Promise<AgentAnalysisResult> {
    return this.runner.run(context, {
      agentType: this.type,
      instructions: REQUIREMENTS_PROMPT,
      allowedTools: AGENT_ALLOWED_TOOLS[this.type],
    });
  }
}
