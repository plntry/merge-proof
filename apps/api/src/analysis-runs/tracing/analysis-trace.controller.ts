import { Controller, Get, Param } from '@nestjs/common';

import { AnalysisTraceService } from './analysis-trace.service.js';

@Controller('analysis-runs')
export class AnalysisTraceController {
  constructor(private readonly analysisTraceService: AnalysisTraceService) {}

  @Get(':id/trace')
  getTrace(@Param('id') id: string) {
    return this.analysisTraceService.getTrace(id);
  }
}
