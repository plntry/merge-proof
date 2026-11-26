import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TOOL_LIMITS } from './tool.constants.js';
import { ToolExecutionError } from './tool.errors.js';
import type { RepositorySource } from './repository-source.interface.js';
import { repositoryPathSchema } from './tool.schemas.js';
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

type GithubPullRequest = {
  title: string;
  body: string | null;
  state: string;
  user: { login: string } | null;
  base: { ref: string };
  head: { ref: string; sha: string };
};

type GithubChangedFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
};

type GithubContent = { content: string; encoding: string };
type GithubSearchItem = {
  path: string;
  text_matches?: Array<{ fragment: string }>;
};

const PAGE_SIZE = 30;
const MAX_GITHUB_PAGES = Math.ceil(TOOL_LIMITS.maxChangedFiles / PAGE_SIZE);
const REQUEST_TIMEOUT_MS = 5_000;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

@Injectable()
export class GitHubRepositorySource implements RepositorySource {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('GITHUB_API_URL') ?? 'https://api.github.com').replace(/\/$/, '');
    this.token = config.get<string>('GITHUB_TOKEN') ?? '';
  }

  async getPrMetadata(input: GetPrMetadataInput): Promise<PrMetadata> {
    const { pullRequest } = await this.getPullRequest(input.repository, input.pullRequestNumber);
    return this.toMetadata(input.repository, input.pullRequestNumber, pullRequest);
  }

  async getChangedFiles(input: GetChangedFilesInput): Promise<ChangedFile[]> {
    const repository = this.repositoryPath(input.repository);
    const files: ChangedFile[] = [];
    for (let page = 1; page <= MAX_GITHUB_PAGES && files.length < TOOL_LIMITS.maxChangedFiles; page += 1) {
      const items = await this.request<GithubChangedFile[]>(
        `/repos/${repository}/pulls/${input.pullRequestNumber}/files?per_page=${PAGE_SIZE}&page=${page}`,
        'pull_request_not_found',
      );
      files.push(...items.map((item) => ({
        path: item.filename,
        status: item.status === 'added' ? 'added' : item.status === 'removed' ? 'deleted' : 'modified',
        additions: item.additions,
        deletions: item.deletions,
      } satisfies ChangedFile)));
      if (items.length < PAGE_SIZE) break;
    }
    return files.slice(0, TOOL_LIMITS.maxChangedFiles);
  }

  async getFileContent(input: GetFileContentInput, pullRequestNumber?: number): Promise<FileContent> {
    const repository = this.repositoryPath(input.repository);
    const safePath = this.pathSegments(input.path);
    let ref: string | undefined;
    if (pullRequestNumber !== undefined) {
      const { pullRequest } = await this.getPullRequest(input.repository, pullRequestNumber);
      ref = pullRequest.head.sha;
    }
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const file = await this.request<GithubContent>(
      `/repos/${repository}/contents/${safePath}${query}`,
      'file_not_found',
    );
    if (file.encoding !== 'base64') {
      throw new ToolExecutionError('provider_failure', 'GitHub returned an unsupported file encoding.');
    }
    const content = Buffer.from(file.content.replace(/\s/g, ''), 'base64')
      .toString('utf8')
      .slice(0, TOOL_LIMITS.maxFileContentLength);
    return { path: input.path, content };
  }

  async searchRepository(input: SearchRepositoryInput): Promise<RepositorySearchResult[]> {
    this.repositoryPath(input.repository);
    const query = encodeURIComponent(`${input.query} repo:${input.repository}`);
    const result = await this.request<{ items: GithubSearchItem[] }>(
      `/search/code?q=${query}&per_page=${TOOL_LIMITS.maxSearchResults}`,
      'repository_not_found',
      'application/vnd.github.text-match+json',
    );
    return result.items.slice(0, TOOL_LIMITS.maxSearchResults).flatMap((item) => {
      const fragment = item.text_matches?.[0]?.fragment;
      if (!fragment) return [];
      return [{
        path: item.path,
        line: null,
        snippet: fragment.trim().slice(0, TOOL_LIMITS.maxSearchSnippetLength),
      }];
    });
  }

  private async getPullRequest(repository: string, number: number) {
    const path = this.repositoryPath(repository);
    const pullRequest = await this.request<GithubPullRequest>(
      `/repos/${path}/pulls/${number}`,
      'pull_request_not_found',
    );
    return { pullRequest };
  }

  private toMetadata(repository: string, number: number, pr: GithubPullRequest): PrMetadata {
    return {
      repository,
      pullRequestNumber: number,
      title: pr.title,
      description: pr.body,
      author: pr.user?.login ?? 'unknown',
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
    };
  }

  private repositoryPath(repository: string): string {
    if (!REPOSITORY_PATTERN.test(repository)) {
      throw new ToolExecutionError('invalid_arguments', 'Repository must use the owner/name format.');
    }
    return repository.split('/').map(encodeURIComponent).join('/');
  }

  private pathSegments(path: string): string {
    const validation = repositoryPathSchema.safeParse(path);
    if (!validation.success) {
      throw new ToolExecutionError('invalid_arguments', 'File path must be a safe repository-relative path.');
    }
    return path.split('/').map(encodeURIComponent).join('/');
  }

  private async request<T>(
    path: string,
    notFoundCode: 'repository_not_found' | 'pull_request_not_found' | 'file_not_found',
    accept = 'application/vnd.github+json',
  ): Promise<T> {
    if (!this.token) {
      throw new ToolExecutionError('provider_failure', 'GitHub integration is not configured with a token.');
    }
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: {
          accept,
          authorization: `Bearer ${this.token}`,
          'x-github-api-version': '2022-11-28',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ToolExecutionError('timeout', 'GitHub did not respond before the request deadline.');
      }
      throw new ToolExecutionError('provider_failure', 'GitHub could not be reached.');
    }

    if (response.status === 404) {
      throw new ToolExecutionError(notFoundCode, 'The requested GitHub resource was not found or is not accessible.');
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) {
      throw new ToolExecutionError('provider_failure', 'GitHub denied the request or its rate limit was reached.');
    }
    if (!response.ok) {
      throw new ToolExecutionError('provider_failure', `GitHub returned HTTP ${response.status}.`);
    }
    try {
      return await response.json() as T;
    } catch {
      throw new ToolExecutionError('provider_failure', 'GitHub returned an invalid response.');
    }
  }
}
