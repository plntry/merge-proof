import type {
  GetChangedFilesInput,
  GetFileContentInput,
  GetPrMetadataInput,
  SearchRepositoryInput,
} from './tool.schemas.js';
import type { ToolErrorCode } from './tool.errors.js';
import type { AgentType } from '../agents/analysis-agent.types.js';

export const TOOL_NAMES = [
  'getPRMetadata',
  'getChangedFiles',
  'getFileContent',
  'searchRepository',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export type PrMetadata = {
  repository: string;
  pullRequestNumber: number;
  title: string;
  description: string | null;
  author: string;
  baseBranch: string;
  headBranch: string;
};

export type ChangedFile = {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
};

export type FileContent = {
  path: string;
  content: string;
};

export type RepositorySearchResult = {
  path: string;
  line: number | null;
  snippet: string;
};

export type ToolInputByName = {
  getPRMetadata: GetPrMetadataInput;
  getChangedFiles: GetChangedFilesInput;
  getFileContent: GetFileContentInput;
  searchRepository: SearchRepositoryInput;
};

export type ToolOutputByName = {
  getPRMetadata: PrMetadata;
  getChangedFiles: ChangedFile[];
  getFileContent: FileContent;
  searchRepository: RepositorySearchResult[];
};

export type ToolExecutionContext = {
  analysisRunId: string;
  agentRunId: string;
  agentType: AgentType;
  repository: string;
  pullRequestNumber: number;
};

export type ToolExecutionResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ToolErrorCode;
        message: string;
      };
    };
