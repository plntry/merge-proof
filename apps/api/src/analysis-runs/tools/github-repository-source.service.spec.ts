import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOOL_LIMITS } from './tool.constants.js';
import { GitHubRepositorySource } from './github-repository-source.service.js';

const pullRequest = {
  title: 'Add guarded review creation',
  body: 'Checks permission before consuming credits.',
  state: 'open',
  user: { login: 'reviewer' },
  base: { ref: 'main' },
  head: { ref: 'feature/guarded-review', sha: 'head-sha-123' },
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function createSource(token = 'test-github-token') {
  return new GitHubRepositorySource({
    get: (key: string) => key === 'GITHUB_API_URL' ? 'https://api.github.test' : token,
    getOrThrow: (key: string) => key === 'GITHUB_TOKEN' ? token : undefined,
  } as never);
}

afterEach(() => vi.unstubAllGlobals());

describe('GitHubRepositorySource', () => {
  it('maps pull request metadata and sends the server-side bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(pullRequest));
    vi.stubGlobal('fetch', fetchMock);
    const source = createSource();

    await expect(source.getPrMetadata({ repository: 'team/repo', pullRequestNumber: 12 })).resolves.toEqual({
      repository: 'team/repo',
      pullRequestNumber: 12,
      title: pullRequest.title,
      description: pullRequest.body,
      author: 'reviewer',
      baseBranch: 'main',
      headBranch: 'feature/guarded-review',
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.test/repos/team/repo/pulls/12');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer test-github-token');
  });

  it('paginates changed files and caps the normalized result', async () => {
    const pages = [
      Array.from({ length: 30 }, (_, index) => ({ filename: `added-${index}.ts`, status: 'added', additions: 2, deletions: 0 })),
      Array.from({ length: 30 }, (_, index) => ({ filename: `removed-${index}.ts`, status: 'removed', additions: 0, deletions: 1 })),
      Array.from({ length: 30 }, (_, index) => ({ filename: `renamed-${index}.ts`, status: 'renamed', additions: 1, deletions: 1 })),
      Array.from({ length: 30 }, (_, index) => ({ filename: `modified-${index}.ts`, status: 'modified', additions: 1, deletions: 0 })),
    ];
    const fetchMock = vi.fn((url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));
      return Promise.resolve(response(pages[page - 1]));
    });
    vi.stubGlobal('fetch', fetchMock);
    const files = await createSource().getChangedFiles({ repository: 'team/repo', pullRequestNumber: 12 });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(files).toHaveLength(TOOL_LIMITS.maxChangedFiles);
    expect(files[0]).toMatchObject({ status: 'added', additions: 2 });
    expect(files[30]).toMatchObject({ status: 'deleted', deletions: 1 });
    expect(files[60].status).toBe('modified');
  });

  it('reads content at the pull request head SHA and enforces the content cap', async () => {
    const fileBody = Buffer.from('x'.repeat(TOOL_LIMITS.maxFileContentLength + 10)).toString('base64');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(pullRequest))
      .mockResolvedValueOnce(response({ content: fileBody, encoding: 'base64' }));
    vi.stubGlobal('fetch', fetchMock);
    const file = await createSource().getFileContent(
      { repository: 'team/repo', path: 'src/review.ts' },
      12,
    );

    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get('ref')).toBe('head-sha-123');
    expect(file.content).toHaveLength(TOOL_LIMITS.maxFileContentLength);
  });

  it('returns bounded code search snippets without inventing line numbers', async () => {
    const items = Array.from({ length: 25 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      text_matches: [{ fragment: `line with permission ${index}` }],
    }));
    const fetchMock = vi.fn().mockResolvedValue(response({ items }));
    vi.stubGlobal('fetch', fetchMock);
    const results = await createSource().searchRepository({ repository: 'team/repo', query: 'permission' });

    expect(results).toHaveLength(TOOL_LIMITS.maxSearchResults);
    expect(results[0]).toMatchObject({ line: null, snippet: 'line with permission 0' });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('q')).toBe('permission repo:team/repo');
  });

  it('maps missing resources, authorization failures, and timeouts to controlled errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 404)));
    await expect(createSource().getPrMetadata({ repository: 'team/repo', pullRequestNumber: 12 }))
      .rejects.toMatchObject({ code: 'pull_request_not_found' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({}, 403)));
    await expect(createSource().getPrMetadata({ repository: 'team/repo', pullRequestNumber: 12 }))
      .rejects.toMatchObject({ code: 'provider_failure' });

    const timeout = new Error('private socket detail');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(timeout));
    await expect(createSource().getPrMetadata({ repository: 'team/repo', pullRequestNumber: 12 }))
      .rejects.toMatchObject({ code: 'timeout', message: 'GitHub did not respond before the request deadline.' });
  });

  it('validates repository and path values before making requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const source = createSource();
    await expect(source.getPrMetadata({ repository: 'team/repo/extra', pullRequestNumber: 12 }))
      .rejects.toMatchObject({ code: 'invalid_arguments' });
    await expect(source.getFileContent({ repository: 'team/repo', path: '../secret' }, 12))
      .rejects.toMatchObject({ code: 'invalid_arguments' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
