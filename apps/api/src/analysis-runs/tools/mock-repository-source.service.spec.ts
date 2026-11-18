import { MockRepositorySource } from './mock-repository-source.service.js';
import { TOOL_LIMITS } from './tool.constants.js';

describe('MockRepositorySource', () => {
  const source = new MockRepositorySource();

  it('returns the sample pull request and changed files', async () => {
    await expect(
      source.getPrMetadata({
        repository: 'merge-proof',
        pullRequestNumber: 42,
      }),
    ).resolves.toMatchObject({
      title: 'Add organization credit validation',
    });

    const files = await source.getChangedFiles({
      repository: 'merge-proof',
      pullRequestNumber: 42,
    });
    expect(files.length).toBeLessThanOrEqual(TOOL_LIMITS.maxChangedFiles);
  });

  it('returns bounded file and search data', async () => {
    const file = await source.getFileContent({
      repository: 'merge-proof',
      path: 'src/reviews/reviews.service.ts',
    });
    expect(file.content.length).toBeLessThanOrEqual(
      TOOL_LIMITS.maxFileContentLength,
    );

    const results = await source.searchRepository({
      repository: 'merge-proof',
      query: 'credits',
    });
    expect(results.length).toBeLessThanOrEqual(TOOL_LIMITS.maxSearchResults);
    expect(
      results.every(
        (result) =>
          result.snippet.length <= TOOL_LIMITS.maxSearchSnippetLength,
      ),
    ).toBe(true);
  });

  it('fails with controlled missing-resource errors', async () => {
    await expect(
      source.getPrMetadata({
        repository: 'missing',
        pullRequestNumber: 42,
      }),
    ).rejects.toMatchObject({ code: 'repository_not_found' });

    await expect(
      source.getFileContent({
        repository: 'merge-proof',
        path: 'missing.ts',
      }),
    ).rejects.toMatchObject({ code: 'file_not_found' });
  });
});
