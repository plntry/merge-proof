export const FINDING_SEVERITIES = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export type RequirementFinding = {
  title: string;
  description: string;
  severity: FindingSeverity;
  confidence: number;
};

export type RequirementsAnalysisResult = {
  findings: RequirementFinding[];
};
