import { ArchitectureAgent } from './architecture-agent.service.js';
import { RequirementsAgent } from './requirements-agent.service.js';
import { SecurityAgent } from './security-agent.service.js';
import { TestAgent } from './test-agent.service.js';
import type { ToolCallingAgentRunner } from './tool-calling-agent-runner.service.js';

describe('specialized agents', () => {
  it('use distinct prompts and explicit tool permissions', async () => {
    const run = vi.fn().mockResolvedValue({ findings: [] });
    const runner = { run } as unknown as ToolCallingAgentRunner;
    const agents = [
      new RequirementsAgent(runner),
      new SecurityAgent(runner),
      new ArchitectureAgent(runner),
      new TestAgent(runner),
    ];
    const context = {
      analysisRunId: 'analysis-run-id',
      agentRunId: 'agent-run-id',
      repository: 'merge-proof',
      pullRequestNumber: 42,
    };

    await Promise.all(agents.map((agent) => agent.run(context)));

    const configs = run.mock.calls.map((call) => call[1] as {
      agentType: string;
      instructions: string;
      allowedTools: readonly string[];
    });
    expect(configs.map((config) => config.agentType)).toEqual([
      'requirements',
      'security',
      'architecture',
      'tests',
    ]);
    expect(new Set(configs.map((config) => config.instructions)).size).toBe(4);
    expect(configs[2].allowedTools).not.toContain('getPRMetadata');
    expect(configs.every((config) => config.instructions.includes('evidence'))).toBe(
      true,
    );
  });
});
