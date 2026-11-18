export const TOOL_LIMITS = {
  maxRepositoryLength: 200,
  maxPathLength: 500,
  maxSearchQueryLength: 200,
  maxSearchResults: 20,
  maxSearchSnippetLength: 500,
  maxChangedFiles: 100,
  maxFileContentLength: 20_000,
  maxSerializedResultLength: 50_000,
  maxToolExecutionMs: 10_000,
  maxToolCallIterations: 5,
} as const;
