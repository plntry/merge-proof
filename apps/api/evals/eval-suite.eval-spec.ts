import { GOLDEN_EVAL_CASES } from './fixtures/golden-cases.js';
import { formatEvalReport, runEvalSuite } from './runner/eval-runner.js';

describe('MergeProof deterministic eval suite', () => {
  it('passes all golden fixtures without a real OpenAI call', async () => {
    const result = await runEvalSuite(GOLDEN_EVAL_CASES);
    process.stdout.write(`${formatEvalReport(result)}\n`);
    expect(result).toMatchObject({
      providerMode: 'fake',
      totalCases: 6,
      failedCases: 0,
      passed: true,
    });
  });

  it('reports a regression as a failed machine-readable assertion', async () => {
    const clean = structuredClone(
      GOLDEN_EVAL_CASES.find(({ id }) => id === 'clean-pr')!,
    );
    clean.expected.agents = { security: { findingCount: 1 } };
    const result = await runEvalSuite([clean], '2026-01-01T00:00:00.000Z');
    expect(result.passed).toBe(false);
    expect(result.failedCases).toBe(1);
    expect(
      result.cases[0].assertions.find(
        ({ name }) => name === 'security: finding count',
      ),
    ).toMatchObject({ passed: false, expected: 1, actual: 0 });
  });
});
