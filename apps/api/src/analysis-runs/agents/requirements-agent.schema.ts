import { z } from 'zod';
import { FINDING_SEVERITIES } from './requirements-agent.types.js';

export const requirementFindingSchema = z.object({
  title: z.string(),
  description: z.string(),

  severity: z.enum(FINDING_SEVERITIES),

  confidence: z.number().min(0).max(1),
});

export const requirementsAnalysisResultSchema = z.object({
  findings: z.array(requirementFindingSchema),
});
