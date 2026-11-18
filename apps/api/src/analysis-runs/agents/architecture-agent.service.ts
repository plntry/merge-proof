import { Injectable } from '@nestjs/common';

import type { AnalysisAgent } from './analysis-agent.interface.js';
import type {
  AgentAnalysisResult,
  AgentExecutionContext,
} from './analysis-agent.types.js';
import { AGENT_ALLOWED_TOOLS } from './agent-tool-permissions.js';
import { ToolCallingAgentRunner } from './tool-calling-agent-runner.service.js';

const ARCHITECTURE_PROMPT = `
You are MergeProof's architecture analysis agent.

Inspect changed files and related repository implementations for meaningful
architecture regressions introduced by the PR: broken dependency direction,
inappropriate layer coupling, infrastructure leakage, duplicated ownership, violated
module boundaries, and damage to idempotency, atomicity, durability, or separation of
concerns.

Ignore formatting, naming, minor refactoring opportunities, generic design ideals,
and concerns unrelated to the actual change. A valid finding must explain a concrete
maintainability or correctness risk and cite specific repository evidence. Do not
invent missing architecture. Return no findings when the change preserves the
supported boundaries.

Severity describes architectural impact: low is localized debt, medium creates a
meaningful maintenance or correctness risk, high undermines a major system invariant,
and critical threatens systemic integrity. Confidence is evidence certainty from 0
to 1, not severity. Return the required structured findings object only.
`.trim();

@Injectable()
export class ArchitectureAgent implements AnalysisAgent {
  readonly type = 'architecture' as const;

  constructor(private readonly runner: ToolCallingAgentRunner) {}

  run(context: AgentExecutionContext): Promise<AgentAnalysisResult> {
    return this.runner.run(context, {
      agentType: this.type,
      instructions: ARCHITECTURE_PROMPT,
      allowedTools: AGENT_ALLOWED_TOOLS[this.type],
    });
  }
}
