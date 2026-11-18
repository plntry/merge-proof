import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { z, type ZodType } from 'zod';

import {
  REPOSITORY_SOURCE,
  type RepositorySource,
} from './repository-source.interface.js';
import {
  TOOL_CALL_REPOSITORY,
  type ToolCallRepository,
} from './audit/tool-call-repository.interface.js';
import {
  getChangedFilesInputSchema,
  getFileContentInputSchema,
  getPrMetadataInputSchema,
  searchRepositoryInputSchema,
} from './tool.schemas.js';
import { TOOL_LIMITS } from './tool.constants.js';
import {
  ToolExecutionError,
  toControlledToolError,
} from './tool.errors.js';
import {
  TOOL_NAMES,
  type ToolExecutionContext,
  type ToolExecutionResult,
  type ToolName,
} from './tool.types.js';
import { isToolAllowedForAgent } from '../agents/agent-tool-permissions.js';

type ToolDefinition = {
  schema: ZodType;
  execute: (input: never) => Promise<unknown>;
};

@Injectable()
export class ToolRegistry {
  constructor(
    @Inject(REPOSITORY_SOURCE)
    private readonly repositorySource: RepositorySource,
    @Inject(TOOL_CALL_REPOSITORY)
    private readonly toolCallRepository: ToolCallRepository,
  ) {}

  async execute(
    context: ToolExecutionContext,
    toolName: string,
    rawArguments: unknown,
  ): Promise<ToolExecutionResult> {
    const preparedArguments = this.prepareArguments(rawArguments);
    const toolCallId = randomUUID();

    await this.toolCallRepository.save({
      id: toolCallId,
      agentRunId: context.agentRunId,
      toolName,
      arguments: preparedArguments.auditValue,
      status: 'pending',
    });

    const running = await this.toolCallRepository.markRunning(toolCallId);

    if (!running) {
      throw new Error(`Tool call ${toolCallId} could not be started`);
    }

    try {
      if (preparedArguments.parseError) {
        throw preparedArguments.parseError;
      }

      if (!this.isToolName(toolName)) {
        throw new ToolExecutionError(
          'unknown_tool',
          `Tool ${toolName} is not registered.`,
        );
      }

      if (!isToolAllowedForAgent(context.agentType, toolName)) {
        throw new ToolExecutionError(
          'tool_not_allowed',
          `Tool ${toolName} is not allowed for the ${context.agentType} agent.`,
        );
      }

      const definition = this.getDefinitions()[toolName];
      const validation = definition.schema.safeParse(preparedArguments.value);

      if (!validation.success) {
        throw new ToolExecutionError(
          'invalid_arguments',
          this.formatValidationError(validation.error),
        );
      }

      this.assertScope(context, toolName, validation.data);

      const data = await this.executeWithTimeout(
        definition,
        validation.data as never,
      );
      const result: ToolExecutionResult = { ok: true, data };

      if (
        JSON.stringify(result).length > TOOL_LIMITS.maxSerializedResultLength
      ) {
        throw new ToolExecutionError(
          'result_too_large',
          'The tool result exceeded the maximum size.',
        );
      }

      const completed = await this.toolCallRepository.markCompleted(
        toolCallId,
        data,
      );

      if (!completed) {
        throw new Error(`Tool call ${toolCallId} could not be completed`);
      }

      return result;
    } catch (error) {
      const controlledError = toControlledToolError(error);
      const failed = await this.toolCallRepository.markFailed(
        toolCallId,
        controlledError.message,
      );

      if (!failed) {
        throw new Error(`Tool call ${toolCallId} could not be failed`);
      }

      return { ok: false, error: controlledError };
    }
  }

  private getDefinitions(): Record<ToolName, ToolDefinition> {
    return {
      getPRMetadata: {
        schema: getPrMetadataInputSchema,
        execute: (input) => this.repositorySource.getPrMetadata(input),
      },
      getChangedFiles: {
        schema: getChangedFilesInputSchema,
        execute: (input) => this.repositorySource.getChangedFiles(input),
      },
      getFileContent: {
        schema: getFileContentInputSchema,
        execute: (input) => this.repositorySource.getFileContent(input),
      },
      searchRepository: {
        schema: searchRepositoryInputSchema,
        execute: (input) => this.repositorySource.searchRepository(input),
      },
    };
  }

  private isToolName(value: string): value is ToolName {
    return (TOOL_NAMES as readonly string[]).includes(value);
  }

  private async executeWithTimeout(
    definition: ToolDefinition,
    input: never,
  ): Promise<unknown> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        reject(
          new ToolExecutionError(
            'timeout',
            `The tool exceeded the ${TOOL_LIMITS.maxToolExecutionMs}ms execution limit.`,
          ),
        );
      }, TOOL_LIMITS.maxToolExecutionMs);
    });

    try {
      return await Promise.race([
        definition.execute(input),
        timeoutPromise,
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private prepareArguments(rawArguments: unknown): {
    auditValue: unknown;
    value?: unknown;
    parseError?: ToolExecutionError;
  } {
    if (typeof rawArguments !== 'string') {
      return { auditValue: rawArguments ?? null, value: rawArguments };
    }

    try {
      const value: unknown = JSON.parse(rawArguments);
      return { auditValue: value, value };
    } catch {
      return {
        auditValue: { raw: rawArguments.slice(0, 5_000) },
        parseError: new ToolExecutionError(
          'invalid_arguments',
          'Tool arguments must be valid JSON.',
        ),
      };
    }
  }

  private formatValidationError(error: z.ZodError): string {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })
      .join('; ');
  }

  private assertScope(
    context: ToolExecutionContext,
    toolName: ToolName,
    input: unknown,
  ): void {
    const scopedInput = input as {
      repository: string;
      pullRequestNumber?: number;
    };

    if (scopedInput.repository !== context.repository) {
      throw new ToolExecutionError(
        'scope_mismatch',
        'Tool requests must target the repository under review.',
      );
    }

    if (
      (toolName === 'getPRMetadata' || toolName === 'getChangedFiles') &&
      scopedInput.pullRequestNumber !== context.pullRequestNumber
    ) {
      throw new ToolExecutionError(
        'scope_mismatch',
        'Tool requests must target the pull request under review.',
      );
    }
  }
}
