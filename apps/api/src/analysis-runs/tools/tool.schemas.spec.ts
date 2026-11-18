import {
  getFileContentInputSchema,
  getPrMetadataInputSchema,
  searchRepositoryInputSchema,
} from './tool.schemas.js';

describe('tool schemas', () => {
  it('accepts valid pull request input', () => {
    expect(
      getPrMetadataInputSchema.parse({
        repository: 'merge-proof',
        pullRequestNumber: 42,
      }),
    ).toEqual({ repository: 'merge-proof', pullRequestNumber: 42 });
  });

  it.each([0, -1, 1.5])('rejects invalid PR number %s', (value) => {
    expect(() =>
      getPrMetadataInputSchema.parse({
        repository: 'merge-proof',
        pullRequestNumber: value,
      }),
    ).toThrow();
  });

  it('rejects an empty repository', () => {
    expect(() =>
      getPrMetadataInputSchema.parse({
        repository: ' ',
        pullRequestNumber: 42,
      }),
    ).toThrow();
  });

  it.each(['', '../secret', 'src/../../secret', '/etc/passwd', '..\\secret'])(
    'rejects unsafe path %j',
    (path) => {
      expect(() =>
        getFileContentInputSchema.parse({ repository: 'merge-proof', path }),
      ).toThrow();
    },
  );

  it('rejects empty and oversized search queries', () => {
    expect(() =>
      searchRepositoryInputSchema.parse({
        repository: 'merge-proof',
        query: '',
      }),
    ).toThrow();
    expect(() =>
      searchRepositoryInputSchema.parse({
        repository: 'merge-proof',
        query: 'x'.repeat(201),
      }),
    ).toThrow();
  });
});
