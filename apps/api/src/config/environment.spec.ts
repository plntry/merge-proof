import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment.js';

describe('validateEnvironment', () => {
  it('applies safe local defaults and parses the port', () => {
    expect(validateEnvironment({
      DATABASE_URL: 'postgresql://localhost:5432/mergeproof',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'test-model',
      PORT: '3100',
    })).toMatchObject({
      PORT: 3100,
      REDIS_URL: 'redis://localhost:6379',
      WEB_ORIGIN: 'http://localhost:3000',
    });
  });

  it('reports invalid configuration without echoing values', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'not-a-url' })).toThrow(
      'Invalid application configuration: DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL',
    );
  });

  it('requires a server-side GitHub token only when GitHub is selected', () => {
    expect(() => validateEnvironment({
      DATABASE_URL: 'postgresql://localhost:5432/mergeproof',
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL: 'test-model',
      REPOSITORY_SOURCE: 'github',
    })).toThrow('Invalid application configuration: GITHUB_TOKEN');
  });
});
