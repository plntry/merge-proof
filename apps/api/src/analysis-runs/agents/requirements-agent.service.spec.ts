import type OpenAI from 'openai';
import type { ConfigService } from '@nestjs/config';

import { RequirementsAgent } from './requirements-agent.service.js';
import type { ToolRegistry } from '../tools/tool-registry.service.js';

function toolResponse(
  id: string,
  callId: string,
  name: string,
  argumentsValue: object,
) {
  return {
    id,
    status: 'completed',
    output: [
      {
        type: 'function_call',
        call_id: callId,
        name,
        arguments: JSON.stringify(argumentsValue),
      },
    ],
    output_parsed: null,
  };
}

describe('RequirementsAgent', () => {
  const analysisInput = {
    agentRunId: 'agent-run-id',
    repository: 'merge-proof',
    pullRequestNumber: 42,
  };
  let parse: ReturnType<typeof vi.fn>;
  let registry: ToolRegistry;
  let agent: RequirementsAgent;
  let executeTool: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    parse = vi.fn();
    const openai = { responses: { parse } } as unknown as OpenAI;
    const configService = {
      getOrThrow: vi.fn().mockReturnValue('test-model'),
    } as unknown as ConfigService;
    executeTool = vi.fn().mockResolvedValue({ ok: true, data: [] });
    registry = { execute: executeTool } as unknown as ToolRegistry;
    agent = new RequirementsAgent(openai, configService, registry);
  });

  it('executes sequential tool calls and returns validated findings', async () => {
    parse
      .mockResolvedValueOnce(
        toolResponse('response-1', 'call-1', 'getChangedFiles', {
          repository: 'merge-proof',
          pullRequestNumber: 42,
        }),
      )
      .mockResolvedValueOnce(
        toolResponse('response-2', 'call-2', 'getFileContent', {
          repository: 'merge-proof',
          path: 'src/reviews/reviews.service.ts',
        }),
      )
      .mockResolvedValueOnce({
        id: 'response-3',
        status: 'completed',
        output: [],
        output_parsed: {
          findings: [
            {
              title: 'Missing requirement coverage',
              description: 'A supported finding.',
              severity: 'medium',
              confidence: 0.9,
            },
          ],
        },
      });

    const result = await agent.analyze(analysisInput);

    expect(result.findings).toHaveLength(1);
    expect(executeTool).toHaveBeenNthCalledWith(
      1,
      analysisInput,
      'getChangedFiles',
      JSON.stringify({
        repository: 'merge-proof',
        pullRequestNumber: 42,
      }),
    );
    expect(executeTool).toHaveBeenNthCalledWith(
      2,
      analysisInput,
      'getFileContent',
      JSON.stringify({
        repository: 'merge-proof',
        path: 'src/reviews/reviews.service.ts',
      }),
    );
    expect(parse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        previous_response_id: 'response-1',
        input: [
          {
            type: 'function_call_output',
            call_id: 'call-1',
            output: JSON.stringify({ ok: true, data: [] }),
          },
        ],
      }),
    );
  });

  it('supports multiple tool calls in one response', async () => {
    parse
      .mockResolvedValueOnce({
        id: 'response-1',
        status: 'completed',
        output_parsed: null,
        output: [
          {
            type: 'function_call',
            call_id: 'call-1',
            name: 'getPRMetadata',
            arguments: JSON.stringify({
              repository: 'merge-proof',
              pullRequestNumber: 42,
            }),
          },
          {
            type: 'function_call',
            call_id: 'call-2',
            name: 'getChangedFiles',
            arguments: JSON.stringify({
              repository: 'merge-proof',
              pullRequestNumber: 42,
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        id: 'response-2',
        status: 'completed',
        output: [],
        output_parsed: { findings: [] },
      });

    await expect(agent.analyze(analysisInput)).resolves.toEqual({
      findings: [],
    });
    expect(executeTool).toHaveBeenCalledTimes(2);
    expect(parse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.arrayContaining([
          expect.objectContaining({ call_id: 'call-1' }),
          expect.objectContaining({ call_id: 'call-2' }),
        ]),
      }),
    );
  });

  it('stops after the maximum tool-call iteration count', async () => {
    for (let index = 0; index < 6; index += 1) {
      parse.mockResolvedValueOnce(
        toolResponse(`response-${index}`, `call-${index}`, 'getPRMetadata', {
          repository: 'merge-proof',
          pullRequestNumber: 42,
        }),
      );
    }

    await expect(agent.analyze(analysisInput)).rejects.toThrow(
      'exceeded 5 tool-call iterations',
    );
    expect(executeTool).toHaveBeenCalledTimes(5);
  });

  it('rejects invalid structured final output', async () => {
    parse.mockResolvedValueOnce({
      id: 'response-1',
      status: 'completed',
      output: [],
      output_parsed: {
        findings: [
          {
            title: 'Invalid confidence',
            description: 'Outside the schema.',
            severity: 'medium',
            confidence: 2,
          },
        ],
      },
    });

    await expect(agent.analyze(analysisInput)).rejects.toThrow();
  });
});
