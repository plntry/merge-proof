import type { AgentType } from '../agents/analysis-agent.types.js';
import type { FindingRepository } from './repositories/finding-repository.interface.js';
import { FindingProjectionService } from './finding-projection.service.js';

describe('FindingProjectionService', () => {
  let replaceForAgentRun: ReturnType<typeof vi.fn>;
  let service: FindingProjectionService;

  beforeEach(() => {
    replaceForAgentRun = vi.fn().mockResolvedValue([]);
    service = new FindingProjectionService({
      replaceForAgentRun,
      findByAnalysisRunId: vi.fn(),
    } as unknown as FindingRepository);
  });

  it.each<AgentType>(['requirements', 'security', 'architecture', 'tests'])(
    'projects validated %s findings through the shared contract',
    async (agentType) => {
      const output = {
        findings: [
          {
            title: `${agentType} finding`,
            description: 'Supported by repository evidence.',
            severity: 'medium',
            confidence: 0.9,
          },
        ],
      };

      await expect(
        service.projectAgentOutput(
          'analysis-run-id',
          `${agentType}-run-id`,
          output,
        ),
      ).resolves.toBe(1);
      expect(replaceForAgentRun).toHaveBeenLastCalledWith(
        `${agentType}-run-id`,
        [
          expect.objectContaining({
            analysisRunId: 'analysis-run-id',
            agentRunId: `${agentType}-run-id`,
            title: `${agentType} finding`,
          }),
        ],
      );
    },
  );

  it('replaces rather than appends when re-projecting', async () => {
    const output = { findings: [] };

    await service.projectAgentOutput('analysis-run-id', 'agent-run-id', output);
    await service.projectAgentOutput('analysis-run-id', 'agent-run-id', output);

    expect(replaceForAgentRun).toHaveBeenCalledTimes(2);
    expect(replaceForAgentRun).toHaveBeenNthCalledWith(1, 'agent-run-id', []);
    expect(replaceForAgentRun).toHaveBeenNthCalledWith(2, 'agent-run-id', []);
  });

  it('rejects invalid AI output before persistence', async () => {
    await expect(
      service.projectAgentOutput('analysis-run-id', 'agent-run-id', {
        findings: [{ severity: 'impossible' }],
      }),
    ).rejects.toThrow();
    expect(replaceForAgentRun).not.toHaveBeenCalled();
  });
});
