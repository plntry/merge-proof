export const TOOL_ERROR_CODES = [
  'invalid_arguments',
  'unknown_tool',
  'tool_not_allowed',
  'scope_mismatch',
  'repository_not_found',
  'pull_request_not_found',
  'file_not_found',
  'provider_failure',
  'timeout',
  'result_too_large',
] as const;

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];

export class ToolExecutionError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export function toControlledToolError(error: unknown): {
  code: ToolErrorCode;
  message: string;
} {
  if (error instanceof ToolExecutionError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: 'provider_failure',
    message: 'The repository provider could not complete the tool request.',
  };
}
