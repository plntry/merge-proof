import { z } from 'zod';

import { FINDING_SEVERITIES } from './analysis-agent.types.js';

export const agentFindingSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(FINDING_SEVERITIES),
  confidence: z.number().min(0).max(1),
});

export const agentAnalysisResultSchema = z.object({
  findings: z.array(agentFindingSchema),
});
