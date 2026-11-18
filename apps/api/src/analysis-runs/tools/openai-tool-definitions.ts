import { zodResponsesFunction } from 'openai/helpers/zod';

import {
  getChangedFilesInputSchema,
  getFileContentInputSchema,
  getPrMetadataInputSchema,
  searchRepositoryInputSchema,
} from './tool.schemas.js';
import type { ToolName } from './tool.types.js';

const TOOL_DEFINITIONS_BY_NAME = {
  getPRMetadata: zodResponsesFunction({
    name: 'getPRMetadata',
    description:
      'Read pull request title, description, author, and branch context to understand the requested change.',
    parameters: getPrMetadataInputSchema,
  }),
  getChangedFiles: zodResponsesFunction({
    name: 'getChangedFiles',
    description:
      'List files changed by the pull request before deciding which implementations or tests need inspection.',
    parameters: getChangedFilesInputSchema,
  }),
  getFileContent: zodResponsesFunction({
    name: 'getFileContent',
    description:
      'Read the bounded content of a relevant repository file identified by the changed-file list or repository search.',
    parameters: getFileContentInputSchema,
  }),
  searchRepository: zodResponsesFunction({
    name: 'searchRepository',
    description:
      'Search the repository for related implementations, validations, types, tests, or references when their paths are not known.',
    parameters: searchRepositoryInputSchema,
  }),
};

export function getOpenAiToolDefinitions(toolNames: readonly ToolName[]) {
  return toolNames.map((toolName) => TOOL_DEFINITIONS_BY_NAME[toolName]);
}
