import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { EffectiveFindingService } from './findings/effective/effective-finding.service.js';
import type { FindingPresentation } from './findings/effective/effective-finding.types.js';
import {
  ANALYSIS_RUN_REPOSITORY,
  type AnalysisRunRepository,
} from './repositories/analysis-run-repository.interface.js';

@Injectable()
export class AnalysisResultsService {
  constructor(
    @Inject(ANALYSIS_RUN_REPOSITORY)
    private readonly analysisRunRepository: AnalysisRunRepository,
    private readonly effectiveFindingService: EffectiveFindingService,
  ) {}

  async getFindings(analysisRunId: string): Promise<FindingPresentation[]> {
    const analysisRun =
      await this.analysisRunRepository.findById(analysisRunId);

    if (!analysisRun) {
      throw new NotFoundException(`Analysis run ${analysisRunId} not found`);
    }

    const states =
      await this.effectiveFindingService.findByAnalysisRunId(analysisRunId);
    return states.map(({ finding, review }) =>
      this.effectiveFindingService.present(finding, review),
    );
  }
}
