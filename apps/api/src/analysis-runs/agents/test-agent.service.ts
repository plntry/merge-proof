import { Injectable } from '@nestjs/common';

import type { AnalysisAgent } from './analysis-agent.interface.js';
import type {
  AgentAnalysisResult,
  AgentExecutionContext,
} from './analysis-agent.types.js';
import { AGENT_ALLOWED_TOOLS } from './agent-tool-permissions.js';
import { ToolCallingAgentRunner } from './tool-calling-agent-runner.service.js';

const TEST_PROMPT = `
You are MergeProof's test analysis agent.

Determine whether the behavior changed by this pull request is adequately verified.
Inspect changed production code, changed tests, and relevant existing tests. Report
specific missing scenarios where a plausible regression could merge undetected,
including important success, failure, boundary, authorization, transaction, retry,
or idempotency behavior.

Do not say merely "add more tests", demand coverage metrics, report style issues, or
list cases already covered. Every finding must name the exact missing behavior and
cite repository evidence showing both the changed behavior and the coverage gap. Do
not invent unavailable tests. Return no findings when the important behavior is
adequately supported.

Severity describes the risk of merging without that evidence: low is narrow, medium
is meaningful, high covers critical behavior or failure paths, and critical permits
catastrophic undetected regression. Confidence is evidence certainty from 0 to 1,
not severity. Return the required structured findings object only.
`.trim();

@Injectable()
export class TestAgent implements AnalysisAgent {
  readonly type = 'tests' as const;
  readonly promptVersion = 'tests-v1';

  constructor(private readonly runner: ToolCallingAgentRunner) {}

  run(context: AgentExecutionContext): Promise<AgentAnalysisResult> {
    return this.runner.run(context, {
      agentType: this.type,
      promptVersion: this.promptVersion,
      instructions: TEST_PROMPT,
      allowedTools: AGENT_ALLOWED_TOOLS[this.type],
    });
  }
}
