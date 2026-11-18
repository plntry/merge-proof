import type { ToolName } from '../tools/tool.types.js';
import type { AgentType } from './analysis-agent.types.js';

export const AGENT_ALLOWED_TOOLS = {
  requirements: [
    'getPRMetadata',
    'getChangedFiles',
    'getFileContent',
    'searchRepository',
  ],
  security: [
    'getPRMetadata',
    'getChangedFiles',
    'getFileContent',
    'searchRepository',
  ],
  architecture: [
    'getChangedFiles',
    'getFileContent',
    'searchRepository',
  ],
  tests: [
    'getPRMetadata',
    'getChangedFiles',
    'getFileContent',
    'searchRepository',
  ],
} as const satisfies Record<AgentType, readonly ToolName[]>;

export function isToolAllowedForAgent(
  agentType: AgentType,
  toolName: ToolName,
): boolean {
  return (AGENT_ALLOWED_TOOLS[agentType] as readonly ToolName[]).includes(
    toolName,
  );
}
