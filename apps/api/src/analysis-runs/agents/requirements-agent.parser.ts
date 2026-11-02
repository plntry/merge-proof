import type { RequirementsAnalysisResult } from './requirements-agent.types.js';
import { requirementsAnalysisResultSchema } from './requirements-agent.schema.js';
import z from 'zod';

export function parseRequirementsAnalysisResult(
  input: unknown,
): RequirementsAnalysisResult {
  return requirementsAnalysisResultSchema.parse(input);
}
