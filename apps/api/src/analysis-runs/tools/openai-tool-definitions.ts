import { zodResponsesFunction } from 'openai/helpers/zod';

import {
  getChangedFilesInputSchema,
  getFileContentInputSchema,
  getPrMetadataInputSchema,
  searchRepositoryInputSchema,
} from './tool.schemas.js';

export const REQUIREMENTS_AGENT_TOOLS = [
  zodResponsesFunction({
    name: 'getPRMetadata',
    description:
      'Read pull request title, description, author, and branch context to understand the requested change.',
    parameters: getPrMetadataInputSchema,
  }),
  zodResponsesFunction({
    name: 'getChangedFiles',
    description:
      'List files changed by the pull request before deciding which implementations or tests need inspection.',
    parameters: getChangedFilesInputSchema,
  }),
  zodResponsesFunction({
    name: 'getFileContent',
    description:
      'Read the bounded content of a relevant repository file identified by the changed-file list or repository search.',
    parameters: getFileContentInputSchema,
  }),
  zodResponsesFunction({
    name: 'searchRepository',
    description:
      'Search the repository for related implementations, validations, types, tests, or references when their paths are not known.',
    parameters: searchRepositoryInputSchema,
  }),
];
