import type { EvalCase } from '../eval.types.js';

const emptyAgents = () => ({
  requirements: { findings: [], tools: ['getPRMetadata'] as const },
  security: { findings: [], tools: ['getChangedFiles'] as const },
  architecture: { findings: [], tools: ['getChangedFiles'] as const },
  tests: { findings: [], tools: ['getChangedFiles'] as const },
});

export const GOLDEN_EVAL_CASES: EvalCase[] = [
  {
    id: 'missing-requirement',
    description: 'Required organization credits are not enforced.',
    repositoryContext: {
      title: 'Create review without credit guard',
      description: 'Review creation must consume an organization credit.',
      changedFiles: ['src/reviews/reviews.service.ts'],
    },
    agents: {
      ...emptyAgents(),
      requirements: {
        tools: ['getPRMetadata', 'getFileContent'],
        findings: [
          {
            title: 'Organization credit requirement is not enforced',
            description: 'Review creation persists without consuming a credit.',
            severity: 'medium',
            confidence: 0.95,
          },
        ],
      },
    },
    expected: {
      agents: {
        requirements: {
          findingCount: 1,
          minimumSeverity: 'medium',
          requiredTools: ['getPRMetadata'],
        },
      },
      mergeDecision: 'ready',
    },
  },
  {
    id: 'security-regression',
    description: 'A changed endpoint bypasses authorization.',
    repositoryContext: {
      title: 'Direct organization lookup',
      description: 'Expose organization details.',
      changedFiles: ['src/organizations/organizations.controller.ts'],
    },
    agents: {
      ...emptyAgents(),
      security: {
        tools: ['getChangedFiles', 'getFileContent'],
        findings: [
          {
            title: 'Organization authorization is bypassed',
            description:
              'The changed controller reads organization data directly.',
            severity: 'high',
            confidence: 0.82,
          },
        ],
      },
    },
    expected: {
      agents: {
        security: {
          findingCount: 1,
          minimumSeverity: 'high',
          requiredTools: ['getChangedFiles'],
        },
      },
      mergeDecision: 'needs_review',
      reasonCodes: ['HIGH_CONFIDENCE_HIGH_FINDING'],
    },
  },
  {
    id: 'architecture-boundary',
    description: 'A change breaks the durable repository boundary.',
    repositoryContext: {
      title: 'Write review and credit independently',
      description: 'Refactor review creation.',
      changedFiles: ['src/reviews/reviews.service.ts'],
    },
    agents: {
      ...emptyAgents(),
      architecture: {
        tools: ['getChangedFiles', 'getFileContent'],
        findings: [
          {
            title: 'Review and credit writes are no longer atomic',
            description:
              'The changed service writes through separate transactions.',
            severity: 'high',
            confidence: 0.75,
          },
        ],
      },
    },
    expected: {
      agents: {
        architecture: { findingCount: 1, minimumSeverity: 'high' },
      },
      mergeDecision: 'needs_review',
    },
  },
  {
    id: 'missing-tests',
    description: 'A changed failure path has no regression test.',
    repositoryContext: {
      title: 'Handle insufficient credits',
      description: 'Reject review creation when credits are exhausted.',
      changedFiles: ['src/reviews/reviews.service.ts'],
    },
    agents: {
      ...emptyAgents(),
      tests: {
        tools: ['getChangedFiles', 'getFileContent'],
        findings: [
          {
            title: 'Insufficient-credit failure path is untested',
            description:
              'No test verifies rollback when credit consumption fails.',
            severity: 'high',
            confidence: 0.7,
          },
        ],
      },
    },
    expected: {
      agents: { tests: { findingCount: 1, minimumSeverity: 'high' } },
      mergeDecision: 'needs_review',
    },
  },
  {
    id: 'clean-pr',
    description: 'A supported change has no meaningful regression.',
    repositoryContext: {
      title: 'Clarify review error message',
      description: 'No behavior change.',
      changedFiles: ['src/reviews/reviews.service.ts'],
    },
    agents: emptyAgents(),
    expected: {
      agents: {
        requirements: { findingCount: 0 },
        security: { findingCount: 0 },
        architecture: { findingCount: 0 },
        tests: { findingCount: 0 },
      },
      mergeDecision: 'ready',
    },
  },
  {
    id: 'multi-agent-regression',
    description: 'Authorization is bypassed and the failure path is untested.',
    repositoryContext: {
      title: 'Add direct admin endpoint',
      description: 'Read tenant data without middleware.',
      changedFiles: ['src/admin/admin.controller.ts'],
    },
    agents: {
      ...emptyAgents(),
      security: {
        tools: ['getChangedFiles', 'getFileContent'],
        findings: [
          {
            title: 'Tenant isolation is bypassed',
            description:
              'The endpoint reads cross-tenant data without authorization.',
            severity: 'critical',
            confidence: 0.95,
          },
        ],
      },
      tests: {
        tools: ['getChangedFiles', 'getFileContent'],
        findings: [
          {
            title: 'Cross-tenant denial is untested',
            description: 'No test verifies that another tenant is rejected.',
            severity: 'high',
            confidence: 0.8,
          },
        ],
      },
    },
    expected: {
      agents: {
        security: { findingCount: 1, minimumSeverity: 'critical' },
        tests: { findingCount: 1, minimumSeverity: 'high' },
      },
      mergeDecision: 'blocked',
      reasonCodes: ['HIGH_CONFIDENCE_CRITICAL_FINDING'],
      afterRejectingAgent: { agentType: 'security', decision: 'needs_review' },
    },
  },
];
