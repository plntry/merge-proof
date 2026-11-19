import {
  AGENT_TYPES,
  FINDING_SEVERITIES,
  type AgentType,
  type FindingSeverity,
} from '../../src/analysis-runs/agents/analysis-agent.types.js';
import { agentAnalysisResultSchema } from '../../src/analysis-runs/agents/analysis-agent.schema.js';
import type {
  EvalAssertionResult,
  EvalCase,
  EvalCaseResult,
  EvalSuiteResult,
} from '../eval.types.js';
import { executeEvalCase } from './eval-executor.js';

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export async function runEvalSuite(
  cases: EvalCase[],
  timestamp = new Date().toISOString(),
): Promise<EvalSuiteResult> {
  const results: EvalCaseResult[] = [];

  for (const evalCase of cases) {
    const execution = await executeEvalCase(evalCase);
    const assertions: EvalAssertionResult[] = [];
    const add = (
      name: string,
      category: EvalAssertionResult['category'],
      expected: unknown,
      actual: unknown,
      passed: boolean,
    ) => assertions.push({ name, category, expected, actual, passed });

    for (const agentType of AGENT_TYPES) {
      const output = execution.outputs[agentType];
      add(
        `${agentType}: completed`,
        'workflow',
        true,
        output != null,
        output != null,
      );
      const validation = agentAnalysisResultSchema.safeParse(output);
      add(
        `${agentType}: valid finding contract`,
        'agent-quality',
        true,
        validation.success,
        validation.success,
      );
      const keys = output.findings.map(
        ({ title, description, severity }) =>
          `${title.trim()}|${description.trim()}|${severity}`,
      );
      add(
        `${agentType}: no duplicate findings`,
        'agent-quality',
        keys.length,
        new Set(keys).size,
        keys.length === new Set(keys).size,
      );

      const expected = evalCase.expected.agents?.[agentType];
      if (expected?.findingCount != null) {
        add(
          `${agentType}: finding count`,
          'agent-quality',
          expected.findingCount,
          output.findings.length,
          output.findings.length === expected.findingCount,
        );
      }
      if (expected?.minimumFindings != null) {
        add(
          `${agentType}: minimum finding count`,
          'agent-quality',
          expected.minimumFindings,
          output.findings.length,
          output.findings.length >= expected.minimumFindings,
        );
      }
      if (expected?.maximumFindings != null) {
        add(
          `${agentType}: maximum finding count`,
          'agent-quality',
          expected.maximumFindings,
          output.findings.length,
          output.findings.length <= expected.maximumFindings,
        );
      }
      thisSeverityAssertion(
        add,
        agentType,
        'minimum',
        expected?.minimumSeverity,
        output.findings.map(({ severity }) => severity),
      );
      thisSeverityAssertion(
        add,
        agentType,
        'maximum',
        expected?.maximumSeverity,
        output.findings.map(({ severity }) => severity),
      );
      for (const toolName of expected?.requiredTools ?? []) {
        add(
          `${agentType}: used ${toolName}`,
          'tool-behavior',
          true,
          execution.toolNames[agentType].includes(toolName),
          execution.toolNames[agentType].includes(toolName),
        );
      }
    }

    add(
      'merge decision',
      'decision',
      evalCase.expected.mergeDecision,
      execution.decision.decision,
      execution.decision.decision === evalCase.expected.mergeDecision,
    );
    for (const code of evalCase.expected.reasonCodes ?? []) {
      const actualCodes = execution.decision.reasons.map(
        (reason) => reason.code,
      );
      add(
        `decision reason ${code}`,
        'decision',
        true,
        actualCodes.includes(code),
        actualCodes.includes(code),
      );
    }
    if (evalCase.expected.afterRejectingAgent) {
      add(
        `decision after rejecting ${evalCase.expected.afterRejectingAgent.agentType}`,
        'workflow',
        evalCase.expected.afterRejectingAgent.decision,
        execution.decisionAfterReview?.decision,
        execution.decisionAfterReview?.decision ===
          evalCase.expected.afterRejectingAgent.decision,
      );
    }

    results.push({
      caseId: evalCase.id,
      passed: assertions.every(({ passed }) => passed),
      assertions,
    });
  }

  const passedCases = results.filter(({ passed }) => passed).length;
  return {
    suiteVersion: 'day6-v1',
    providerMode: 'fake',
    model: 'fixture-model-v1',
    promptVersions: {
      requirements: 'requirements-v1',
      security: 'security-v1',
      architecture: 'architecture-v1',
      tests: 'tests-v1',
    },
    timestamp,
    passed: passedCases === results.length,
    totalCases: results.length,
    passedCases,
    failedCases: results.length - passedCases,
    cases: results,
  };
}

function thisSeverityAssertion(
  add: (
    name: string,
    category: EvalAssertionResult['category'],
    expected: unknown,
    actual: unknown,
    passed: boolean,
  ) => void,
  agentType: AgentType,
  bound: 'minimum' | 'maximum',
  expected: FindingSeverity | undefined,
  severities: FindingSeverity[],
): void {
  if (!expected) return;
  const ranks = severities.map((severity) => SEVERITY_RANK[severity]);
  const actualRank = Math.max(...ranks);
  const passed =
    ranks.length > 0 &&
    (bound === 'minimum'
      ? actualRank >= SEVERITY_RANK[expected]
      : actualRank <= SEVERITY_RANK[expected]);
  add(
    `${agentType}: ${bound} severity`,
    'agent-quality',
    expected,
    ranks.length > 0 ? FINDING_SEVERITIES[actualRank] : null,
    passed,
  );
}

export function formatEvalReport(result: EvalSuiteResult): string {
  const lines = ['MergeProof Eval Suite', ''];
  for (const evalCase of result.cases) {
    lines.push(`${evalCase.passed ? 'PASS' : 'FAIL'} ${evalCase.caseId}`);
    for (const assertion of evalCase.assertions.filter(
      ({ passed }) => !passed,
    )) {
      lines.push(
        `  ${assertion.name}: expected ${JSON.stringify(assertion.expected)}, actual ${JSON.stringify(assertion.actual)}`,
      );
    }
  }
  lines.push('', `${result.passedCases}/${result.totalCases} cases passed`);
  return lines.join('\n');
}
