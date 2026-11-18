import { z } from 'zod';

import { TOOL_LIMITS } from './tool.constants.js';

const repositorySchema = z
  .string()
  .trim()
  .min(1, 'repository cannot be empty')
  .max(TOOL_LIMITS.maxRepositoryLength);

const pullRequestNumberSchema = z
  .number()
  .int('pullRequestNumber must be an integer')
  .positive('pullRequestNumber must be positive');

export const repositoryPathSchema = z
  .string()
  .trim()
  .min(1, 'path cannot be empty')
  .max(TOOL_LIMITS.maxPathLength)
  .superRefine((value, context) => {
    const isUnsafe =
      value.startsWith('/') ||
      value.includes('\\') ||
      value.includes('\0') ||
      value.split('/').some((segment) => segment === '..');

    if (isUnsafe) {
      context.addIssue({
        code: 'custom',
        message: 'path must be a safe repository-relative POSIX path',
      });
    }
  });

export const getPrMetadataInputSchema = z
  .object({
    repository: repositorySchema,
    pullRequestNumber: pullRequestNumberSchema,
  })
  .strict();

export const getChangedFilesInputSchema = getPrMetadataInputSchema;

export const getFileContentInputSchema = z
  .object({
    repository: repositorySchema,
    path: repositoryPathSchema,
  })
  .strict();

export const searchRepositoryInputSchema = z
  .object({
    repository: repositorySchema,
    query: z
      .string()
      .trim()
      .min(1, 'query cannot be empty')
      .max(TOOL_LIMITS.maxSearchQueryLength),
  })
  .strict();

export type GetPrMetadataInput = z.infer<typeof getPrMetadataInputSchema>;
export type GetChangedFilesInput = z.infer<
  typeof getChangedFilesInputSchema
>;
export type GetFileContentInput = z.infer<typeof getFileContentInputSchema>;
export type SearchRepositoryInput = z.infer<
  typeof searchRepositoryInputSchema
>;
