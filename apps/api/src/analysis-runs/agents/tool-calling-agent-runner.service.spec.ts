import type { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';

import type { ToolRegistry } from '../tools/tool-registry.service.js';
import { ToolCallingAgentRunner } from './tool-calling-agent-runner.service.js';
import {
  fakeFinalResponse,
  fakeToolResponse,
} from './testing/fake-agent-responses.js';

describe('ToolCallingAgentRunner', () => {
  const context = {
    analysisRunId: 'analysis-run-id',
    agentRunId: 'agent-run-id',
    repository: 'merge-proof',
    pullRequestNumber: 42,
  };
  const config = {
    agentType: 'requirements' as const,
    instructions: 'Requirements-specific instructions',
    allowedTools: [
      'getPRMetadata',
      'getChangedFiles',
      'getFileContent',
      'searchRepository',
    ] as const,
  };
  let parse: ReturnType<typeof vi.fn>;
  let executeTool: ReturnType<typeof vi.fn>;
  let runner: ToolCallingAgentRunner;

  beforeEach(() => {
    parse = vi.fn();
    executeTool = vi.fn().mockResolvedValue({ ok: true, data: [] });
    runner = new ToolCallingAgentRunner(
      { responses: { parse } } as unknown as OpenAI,
      {
        getOrThrow: vi.fn().mockReturnValue('test-model'),
      } as unknown as ConfigService,
      { execute: executeTool } as unknown as ToolRegistry,
    );
  });

  it('executes a reusable tool sequence and validates the final result', async () => {
    parse
      .mockResolvedValueOnce(
        fakeToolResponse('response-1', 'call-1', 'getChangedFiles', {
          repository: 'merge-proof',
          pullRequestNumber: 42,
        }),
      )
      .mockResolvedValueOnce(
        fakeToolResponse('response-2', 'call-2', 'getFileContent', {
          repository: 'merge-proof',
          path: 'src/reviews/reviews.service.ts',
        }),
      )
      .mockResolvedValueOnce(
        fakeFinalResponse([
          {
            title: 'Supported finding',
            description: 'Repository evidence supports this issue.',
            severity: 'medium',
            confidence: 0.9,
          },
        ]),
      );

    const result = await runner.run(context, config);

    expect(result.findings).toHaveLength(1);
    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      {
        agentRunId: 'agent-run-id',
        agentType: 'requirements',
        repository: 'merge-proof',
        pullRequestNumber: 42,
      },
      'getChangedFiles',
      expect.any(String),
    );
    expect(parse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ previous_response_id: 'response-1' }),
    );
  });

  it('exposes only the configured tools', async () => {
    parse.mockResolvedValueOnce(fakeFinalResponse());

    await runner.run(context, {
      agentType: 'architecture',
      instructions: 'Architecture-specific instructions',
      allowedTools: [
        'getChangedFiles',
        'getFileContent',
        'searchRepository',
      ],
    });

    const request = parse.mock.calls[0][0] as {
      tools: Array<{ name: string }>;
    };
    expect(request.tools.map((tool) => tool.name)).toEqual([
      'getChangedFiles',
      'getFileContent',
      'searchRepository',
    ]);
  });

  it('stops after five tool-call iterations', async () => {
    for (let index = 0; index < 6; index += 1) {
      parse.mockResolvedValueOnce(
        fakeToolResponse(`response-${index}`, `call-${index}`, 'getPRMetadata', {
          repository: 'merge-proof',
          pullRequestNumber: 42,
        }),
      );
    }

    await expect(runner.run(context, config)).rejects.toThrow(
      'requirements agent exceeded 5 tool-call iterations',
    );
    expect(executeTool).toHaveBeenCalledTimes(5);
  });

  it('rejects invalid final structured output', async () => {
    parse.mockResolvedValueOnce(
      fakeFinalResponse([
        {
          title: 'Invalid',
          description: 'Invalid confidence.',
          severity: 'medium',
          confidence: 2,
        },
      ]),
    );

    await expect(runner.run(context, config)).rejects.toThrow();
  });
});
