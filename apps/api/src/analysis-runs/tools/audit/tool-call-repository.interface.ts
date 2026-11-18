import type { NewToolCall, ToolCall } from './tool-call.types.js';

export const TOOL_CALL_REPOSITORY = Symbol('TOOL_CALL_REPOSITORY');

export interface ToolCallRepository {
  save(toolCall: NewToolCall): Promise<ToolCall>;
  markRunning(id: string): Promise<ToolCall | undefined>;
  markCompleted(id: string, result: unknown): Promise<ToolCall | undefined>;
  markFailed(id: string, errorMessage: string): Promise<ToolCall | undefined>;
}
