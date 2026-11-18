import type {
  ChangedFile,
  FileContent,
  PrMetadata,
  RepositorySearchResult,
} from './tool.types.js';
import type {
  GetChangedFilesInput,
  GetFileContentInput,
  GetPrMetadataInput,
  SearchRepositoryInput,
} from './tool.schemas.js';

export const REPOSITORY_SOURCE = Symbol('REPOSITORY_SOURCE');

export interface RepositorySource {
  getPrMetadata(input: GetPrMetadataInput): Promise<PrMetadata>;
  getChangedFiles(input: GetChangedFilesInput): Promise<ChangedFile[]>;
  getFileContent(input: GetFileContentInput): Promise<FileContent>;
  searchRepository(
    input: SearchRepositoryInput,
  ): Promise<RepositorySearchResult[]>;
}
