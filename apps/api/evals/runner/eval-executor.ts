import type { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';

import { ArchitectureAgent } from '../../src/analysis-runs/agents/architecture-agent.service.js';
import type { AnalysisAgent } from '../../src/analysis-runs/agents/analysis-agent.interface.js';
import type {
  AgentAnalysisResult,
  AgentType,
} from '../../src/analysis-runs/agents/analysis-agent.types.js';
import { RequirementsAgent } from '../../src/analysis-runs/agents/requirements-agent.service.js';
import { SecurityAgent } from '../../src/analysis-runs/agents/security-agent.service.js';
import { TestAgent } from '../../src/analysis-runs/agents/test-agent.service.js';
import { ToolCallingAgentRunner } from '../../src/analysis-runs/agents/tool-calling-agent-runner.service.js';
import { FindingProjectionService } from '../../src/analysis-runs/findings/finding-projection.service.js';
import type { Finding } from '../../src/analysis-runs/findings/finding.types.js';
import type { EffectiveFinding } from '../../src/analysis-runs/findings/effective/effective-finding.types.js';
import { MergeDecisionEngine } from '../../src/analysis-runs/merge-decision/merge-decision-engine.js';
import type { MergeDecisionResult } from '../../src/analysis-runs/merge-decision/merge-decision.types.js';
import type { RepositorySource } from '../../src/analysis-runs/tools/repository-source.interface.js';
import type { ToolCallRepository } from '../../src/analysis-runs/tools/audit/tool-call-repository.interface.js';
import type {
  NewToolCall,
  ToolCall,
} from '../../src/analysis-runs/tools/audit/tool-call.types.js';
import { ToolRegistry } from '../../src/analysis-runs/tools/tool-registry.service.js';
import type { ToolName } from '../../src/analysis-runs/tools/tool.types.js';
import type { TraceEventRepository } from '../../src/analysis-runs/tracing/repositories/trace-event-repository.interface.js';
import { TraceRecorder } from '../../src/analysis-runs/tracing/trace-recorder.service.js';
import type {
  NewTraceEvent,
  TraceEvent,
} from '../../src/analysis-runs/tracing/trace-event.types.js';
import type { EvalCase } from '../eval.types.js';

export type EvalExecution = {
  outputs: Record<AgentType, AgentAnalysisResult>;
  toolNames: Record<AgentType, ToolName[]>;
  decision: MergeDecisionResult;
  decisionAfterReview?: MergeDecisionResult;
};

export async function executeEvalCase(
  evalCase: EvalCase,
): Promise<EvalExecution> {
  const traceRepository = new MemoryTraceRepository();
  const traceRecorder = new TraceRecorder(traceRepository);
  const toolRepository = new MemoryToolRepository();
  const source = createSource(evalCase);
  const toolRegistry = new ToolRegistry(source, toolRepository, traceRecorder);
  const fakeOpenAi = new FixtureOpenAi(evalCase);
  const runner = new ToolCallingAgentRunner(
    fakeOpenAi.client,
    { getOrThrow: () => 'fixture-model-v1' } as unknown as ConfigService,
    toolRegistry,
    traceRecorder,
  );
  const agents: AnalysisAgent[] = [
    new RequirementsAgent(runner),
    new SecurityAgent(runner),
    new ArchitectureAgent(runner),
    new TestAgent(runner),
  ];
  const findings: Finding[] = [];
  const projection = new FindingProjectionService(
    {
      preserveForAgentRun: async (_agentRunId: string, values: Finding[]) => {
        findings.push(
          ...values.map((value) => ({ ...value, createdAt: new Date() })),
        );
        return findings;
      },
    } as never,
    traceRecorder,
  );
  const outputs = {} as Record<AgentType, AgentAnalysisResult>;
  const agentRunIds = {} as Record<AgentType, string>;

  for (const agent of agents) {
    const agentRunId = `${evalCase.id}-${agent.type}-run`;
    agentRunIds[agent.type] = agentRunId;
    const output = await agent.run({
      analysisRunId: `${evalCase.id}-analysis`,
      agentRunId,
      repository: 'merge-proof-eval',
      pullRequestNumber: 42,
    });
    outputs[agent.type] = output;
    await projection.projectAgentOutput(
      `${evalCase.id}-analysis`,
      agentRunId,
      output,
    );
  }

  const effectiveFindings: EffectiveFinding[] = findings.map((finding) => {
    const agentType = (Object.entries(agentRunIds).find(
      ([, id]) => id === finding.agentRunId,
    )?.[0] ?? 'requirements') as AgentType;
    return {
      findingId: finding.id,
      agentType,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      originalConfidence: finding.confidence,
      reviewStatus: 'unreviewed',
      humanVerified: false,
      excluded: false,
    };
  });
  const engine = new MergeDecisionEngine();
  const coverage = agents.map(({ type: agentType }) => ({
    agentType,
    status: 'completed' as const,
  }));
  const decision = engine.evaluate({
    findings: effectiveFindings,
    agentCoverage: coverage,
  });
  const rejectedAgent = evalCase.expected.afterRejectingAgent?.agentType;
  const decisionAfterReview = rejectedAgent
    ? engine.evaluate({
        findings: effectiveFindings.map((finding) =>
          finding.agentType === rejectedAgent
            ? {
                ...finding,
                reviewStatus: 'rejected' as const,
                excluded: true,
              }
            : finding,
        ),
        agentCoverage: coverage,
      })
    : undefined;
  const toolNames = {} as Record<AgentType, ToolName[]>;
  for (const agent of agents) {
    toolNames[agent.type] = toolRepository.calls
      .filter(({ agentRunId }) => agentRunId === agentRunIds[agent.type])
      .map(({ toolName }) => toolName as ToolName);
  }

  return { outputs, toolNames, decision, decisionAfterReview };
}

class FixtureOpenAi {
  private readonly responseAgents = new Map<string, AgentType>();
  readonly client: OpenAI;

  constructor(private readonly evalCase: EvalCase) {
    this.client = {
      responses: { parse: (body: unknown) => this.parse(body) },
    } as unknown as OpenAI;
  }

  private async parse(bodyValue: unknown) {
    const body = bodyValue as {
      instructions: string;
      previous_response_id?: string;
    };
    const agentType = body.previous_response_id
      ? this.responseAgents.get(body.previous_response_id)!
      : this.agentFromInstructions(body.instructions);
    const responseId = `${this.evalCase.id}-${agentType}-response`;
    this.responseAgents.set(responseId, agentType);

    if (!body.previous_response_id) {
      return {
        id: responseId,
        status: 'completed',
        output: this.evalCase.agents[agentType].tools.map(
          (toolName, index) => ({
            type: 'function_call',
            call_id: `${responseId}-tool-${index}`,
            name: toolName,
            arguments: JSON.stringify(this.toolArguments(toolName)),
          }),
        ),
        output_parsed: null,
        usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      };
    }

    return {
      id: `${responseId}-final`,
      status: 'completed',
      output: [],
      output_parsed: { findings: this.evalCase.agents[agentType].findings },
      usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
    };
  }

  private agentFromInstructions(instructions: string): AgentType {
    if (instructions.includes('requirements analysis agent'))
      return 'requirements';
    if (instructions.includes('security analysis agent')) return 'security';
    if (instructions.includes('architecture analysis agent'))
      return 'architecture';
    return 'tests';
  }

  private toolArguments(toolName: ToolName) {
    if (toolName === 'getPRMetadata' || toolName === 'getChangedFiles') {
      return { repository: 'merge-proof-eval', pullRequestNumber: 42 };
    }
    if (toolName === 'getFileContent') {
      return {
        repository: 'merge-proof-eval',
        path: this.evalCase.repositoryContext.changedFiles[0],
      };
    }
    return { repository: 'merge-proof-eval', query: 'authorization' };
  }
}

function createSource(evalCase: EvalCase): RepositorySource {
  return {
    async getPrMetadata() {
      return {
        repository: 'merge-proof-eval',
        pullRequestNumber: 42,
        title: evalCase.repositoryContext.title,
        description: evalCase.repositoryContext.description,
        author: 'fixture',
        baseBranch: 'main',
        headBranch: evalCase.id,
      };
    },
    async getChangedFiles() {
      return evalCase.repositoryContext.changedFiles.map((path) => ({
        path,
        status: 'modified' as const,
        additions: 10,
        deletions: 2,
      }));
    },
    async getFileContent(input) {
      return {
        path: input.path,
        content: evalCase.repositoryContext.description,
      };
    },
    async searchRepository() {
      return [];
    },
  };
}

class MemoryToolRepository implements ToolCallRepository {
  readonly calls: ToolCall[] = [];

  async findByAgentRunIds(ids: string[]) {
    return this.calls.filter(({ agentRunId }) => ids.includes(agentRunId));
  }
  async save(input: NewToolCall) {
    const call: ToolCall = {
      ...input,
      result: null,
      errorMessage: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
    };
    this.calls.push(call);
    return call;
  }
  async markRunning(id: string) {
    return this.update(id, { status: 'running', startedAt: new Date() });
  }
  async markCompleted(id: string, result: unknown) {
    return this.update(id, {
      status: 'completed',
      result,
      completedAt: new Date(),
    });
  }
  async markFailed(id: string, errorMessage: string) {
    return this.update(id, {
      status: 'failed',
      errorMessage,
      completedAt: new Date(),
    });
  }
  private update(id: string, values: Partial<ToolCall>) {
    const call = this.calls.find((candidate) => candidate.id === id);
    if (!call) return undefined;
    Object.assign(call, values);
    return call;
  }
}

class MemoryTraceRepository implements TraceEventRepository {
  readonly events: TraceEvent[] = [];
  async append(input: NewTraceEvent) {
    const event = { ...input, createdAt: new Date() };
    this.events.push(event);
    return event;
  }
  async findByAnalysisRunId(id: string) {
    return this.events.filter(({ analysisRunId }) => analysisRunId === id);
  }
  async findByAgentRunId(id: string) {
    return this.events.filter(({ agentRunId }) => agentRunId === id);
  }
}
