import { Injectable } from '@nestjs/common';

import type { RepositorySource } from './repository-source.interface.js';
import type {
  GetChangedFilesInput,
  GetFileContentInput,
  GetPrMetadataInput,
  SearchRepositoryInput,
} from './tool.schemas.js';
import type {
  ChangedFile,
  FileContent,
  PrMetadata,
  RepositorySearchResult,
} from './tool.types.js';
import { TOOL_LIMITS } from './tool.constants.js';
import { ToolExecutionError } from './tool.errors.js';
import {
  SAMPLE_CHANGED_FILES,
  SAMPLE_PR_METADATA,
  SAMPLE_REPOSITORY_FILES,
} from './fixtures/sample-pull-request.fixture.js';

@Injectable()
export class MockRepositorySource implements RepositorySource {
  private assertRepository(repository: string): void {
    if (repository !== SAMPLE_PR_METADATA.repository) {
      throw new ToolExecutionError(
        'repository_not_found',
        `Repository ${repository} was not found.`,
      );
    }
  }

  private assertPullRequest(pullRequestNumber: number): void {
    if (pullRequestNumber !== SAMPLE_PR_METADATA.pullRequestNumber) {
      throw new ToolExecutionError(
        'pull_request_not_found',
        `Pull request ${pullRequestNumber} was not found.`,
      );
    }
  }

  async getPrMetadata(input: GetPrMetadataInput): Promise<PrMetadata> {
    this.assertRepository(input.repository);
    this.assertPullRequest(input.pullRequestNumber);
    return { ...SAMPLE_PR_METADATA };
  }

  async getChangedFiles(input: GetChangedFilesInput): Promise<ChangedFile[]> {
    this.assertRepository(input.repository);
    this.assertPullRequest(input.pullRequestNumber);
    return SAMPLE_CHANGED_FILES.slice(0, TOOL_LIMITS.maxChangedFiles).map(
      (file) => ({ ...file }),
    );
  }

  async getFileContent(input: GetFileContentInput): Promise<FileContent> {
    this.assertRepository(input.repository);
    const content = SAMPLE_REPOSITORY_FILES[input.path];

    if (content === undefined) {
      throw new ToolExecutionError(
        'file_not_found',
        `File ${input.path} was not found.`,
      );
    }

    return {
      path: input.path,
      content: content.slice(0, TOOL_LIMITS.maxFileContentLength),
    };
  }

  async searchRepository(
    input: SearchRepositoryInput,
  ): Promise<RepositorySearchResult[]> {
    this.assertRepository(input.repository);
    const normalizedQuery = input.query.toLocaleLowerCase();
    const results: RepositorySearchResult[] = [];

    for (const [path, content] of Object.entries(SAMPLE_REPOSITORY_FILES)) {
      const lines = content.split('\n');

      for (const [index, line] of lines.entries()) {
        if (!line.toLocaleLowerCase().includes(normalizedQuery)) {
          continue;
        }

        results.push({
          path,
          line: index + 1,
          snippet: line.trim().slice(0, TOOL_LIMITS.maxSearchSnippetLength),
        });

        if (results.length === TOOL_LIMITS.maxSearchResults) {
          return results;
        }
      }
    }

    return results;
  }
}
