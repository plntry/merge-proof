import type { RepositorySource } from './repository-source.interface.js';
import type { ToolCallRepository } from './audit/tool-call-repository.interface.js';
import { ToolRegistry } from './tool-registry.service.js';
import { TOOL_LIMITS } from './tool.constants.js';

describe('ToolRegistry', () => {
  const context = {
    agentRunId: 'agent-run-id',
    repository: 'merge-proof',
    pullRequestNumber: 42,
  };
  let source: RepositorySource;
  let auditRepository: ToolCallRepository;
  let registry: ToolRegistry;
  let getPrMetadata: ReturnType<typeof vi.fn>;
  let getFileContent: ReturnType<typeof vi.fn>;
  let markCompleted: ReturnType<typeof vi.fn>;
  let markFailed: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getPrMetadata = vi.fn().mockResolvedValue({
      repository: 'merge-proof',
      pullRequestNumber: 42,
      title: 'Title',
      description: null,
      author: 'author',
      baseBranch: 'main',
      headBranch: 'feature',
    });
    getFileContent = vi
      .fn()
      .mockResolvedValue({ path: 'src/file.ts', content: 'content' });
    source = {
      getPrMetadata,
      getChangedFiles: vi.fn().mockResolvedValue([]),
      getFileContent,
      searchRepository: vi.fn().mockResolvedValue([]),
    };
    markCompleted = vi.fn().mockResolvedValue({});
    markFailed = vi.fn().mockResolvedValue({});
    auditRepository = {
      save: vi.fn().mockResolvedValue({}),
      markRunning: vi.fn().mockResolvedValue({}),
      markCompleted,
      markFailed,
    } as unknown as ToolCallRepository;
    registry = new ToolRegistry(source, auditRepository);
  });

  it('validates and executes a known tool with the correct arguments', async () => {
    const result = await registry.execute(context, 'getPRMetadata', {
      repository: 'merge-proof',
      pullRequestNumber: 42,
    });

    expect(result).toMatchObject({ ok: true });
    expect(getPrMetadata).toHaveBeenCalledWith({
      repository: 'merge-proof',
      pullRequestNumber: 42,
    });
    expect(markCompleted).toHaveBeenCalledOnce();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('fails unknown tools safely and persists the failure', async () => {
    const result = await registry.execute(context, 'readEnvironment', {});

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unknown_tool',
        message: 'Tool readEnvironment is not registered.',
      },
    });
    expect(markFailed).toHaveBeenCalledOnce();
  });

  it('rejects invalid JSON, invalid arguments, and scope changes', async () => {
    await expect(
      registry.execute(context, 'getPRMetadata', '{invalid'),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments' },
    });
    await expect(
      registry.execute(context, 'getPRMetadata', {
        repository: '',
        pullRequestNumber: 0,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid_arguments' },
    });
    await expect(
      registry.execute(context, 'getPRMetadata', {
        repository: 'other-repository',
        pullRequestNumber: 42,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'scope_mismatch' },
    });
    expect(getPrMetadata).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledTimes(3);
  });

  it('rejects an oversized provider result and audits failure', async () => {
    getFileContent.mockResolvedValue({
      path: 'src/file.ts',
      content: 'x'.repeat(TOOL_LIMITS.maxSerializedResultLength),
    });

    const result = await registry.execute(context, 'getFileContent', {
      repository: 'merge-proof',
      path: 'src/file.ts',
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'result_too_large' },
    });
    expect(markFailed).toHaveBeenCalledOnce();
  });

  it('returns and audits a controlled timeout', async () => {
    vi.useFakeTimers();
    getPrMetadata.mockReturnValue(new Promise(() => undefined));

    try {
      const execution = registry.execute(context, 'getPRMetadata', {
        repository: 'merge-proof',
        pullRequestNumber: 42,
      });
      await vi.advanceTimersByTimeAsync(TOOL_LIMITS.maxToolExecutionMs);

      await expect(execution).resolves.toMatchObject({
        ok: false,
        error: { code: 'timeout' },
      });
      expect(markFailed).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
