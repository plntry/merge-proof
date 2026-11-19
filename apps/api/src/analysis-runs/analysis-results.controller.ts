import { Controller, Get, Param } from '@nestjs/common';

import { MergeAssessmentService } from './merge-assessment/merge-assessment.service.js';
import { AnalysisResultsService } from './analysis-results.service.js';

@Controller('analysis-runs')
export class AnalysisResultsController {
  constructor(
    private readonly analysisResultsService: AnalysisResultsService,
    private readonly mergeAssessmentService: MergeAssessmentService,
  ) {}

  @Get(':id/findings')
  getFindings(@Param('id') id: string) {
    return this.analysisResultsService.getFindings(id);
  }

  @Get(':id/assessment')
  getAssessment(@Param('id') id: string) {
    return this.mergeAssessmentService.findByAnalysisRunId(id);
  }
}
