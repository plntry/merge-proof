import { Logger } from '@nestjs/common';

import { TraceRecorder } from './trace-recorder.service.js';

describe('TraceRecorder', () => {
  it('persists a correlated event', async () => {
    const append = vi.fn().mockResolvedValue({});
    const recorder = new TraceRecorder({ append } as never);

    await recorder.record({
      analysisRunId: 'analysis-id',
      agentRunId: 'agent-id',
      toolCallId: null,
      eventType: 'agent.started',
      metadata: { agentType: 'security' },
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        analysisRunId: 'analysis-id',
        agentRunId: 'agent-id',
        eventType: 'agent.started',
      }),
      undefined,
    );
  });

  it('logs but does not fail the business operation when persistence fails', async () => {
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const recorder = new TraceRecorder({
      append: vi.fn().mockRejectedValue(new Error('database unavailable')),
    } as never);

    await expect(
      recorder.record({
        analysisRunId: 'analysis-id',
        agentRunId: null,
        toolCallId: null,
        eventType: 'analysis.started',
        metadata: {},
      }),
    ).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'analysis.started',
        errorType: 'Error',
      }),
    );
    warning.mockRestore();
  });
});
