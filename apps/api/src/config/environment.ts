import { z } from 'zod';

export const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  OPENAI_BASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  REPOSITORY_SOURCE: z.enum(['fixture', 'github']).default('fixture'),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_API_URL: z.string().url().default('https://api.github.com'),
}).superRefine((config, context) => {
  if (config.REPOSITORY_SOURCE === 'github' && !config.GITHUB_TOKEN) {
    context.addIssue({
      code: 'custom',
      path: ['GITHUB_TOKEN'],
      message: 'GITHUB_TOKEN is required when REPOSITORY_SOURCE is github',
    });
  }
  if (config.REPOSITORY_SOURCE === 'github' && config.GITHUB_API_URL) {
    const apiUrl = new URL(config.GITHUB_API_URL);
    if (apiUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(apiUrl.hostname)) {
      context.addIssue({
        code: 'custom',
        path: ['GITHUB_API_URL'],
        message: 'GitHub API must use HTTPS except for local test servers',
      });
    }
  }
});

export function validateEnvironment(input: Record<string, unknown>) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid application configuration: ${fields}`);
  }
  return result.data;
}
