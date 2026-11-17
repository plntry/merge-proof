import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { DatabaseModule } from '../database/database.module.js';

import {
  AGENT_RUN_REPOSITORY,
  type AgentRunRepository,
} from '../analysis-runs/agents/repositories/agent-run.repository.interface.js';

import { PostgresAgentRunRepository } from '../analysis-runs/agents/repositories/postgres-agent-run.repository.js';

import { FINDING_REPOSITORY } from '../analysis-runs/findings/repositories/finding-repository.interface.js';

import { PostgresFindingRepository } from '../analysis-runs/findings/repositories/postgres-finding.repository.js';

import { FindingProjectionService } from '../analysis-runs/findings/finding-projection.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
  ],
  providers: [
    {
      provide: AGENT_RUN_REPOSITORY,
      useClass: PostgresAgentRunRepository,
    },
    {
      provide: FINDING_REPOSITORY,
      useClass: PostgresFindingRepository,
    },
    FindingProjectionService,
  ],
})
class ProjectExistingFindingsModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(
    ProjectExistingFindingsModule,
  );

  try {
    const agentRunRepository =
      app.get<AgentRunRepository>(AGENT_RUN_REPOSITORY);

    const findingProjectionService = app.get(FindingProjectionService);

    const analysisRunId = '33d507a9-28fa-4578-ae8d-d8be42ee1b30';

    const agentRun = await agentRunRepository.findByAnalysisRunAndType(
      analysisRunId,
      'requirements',
    );

    if (!agentRun) {
      throw new Error('Agent run not found');
    }

    if (agentRun.output == null) {
      throw new Error('Agent run has no output');
    }

    await findingProjectionService.projectRequirementsOutput(
      analysisRunId,
      agentRun.id,
      agentRun.output,
    );

    console.log('Findings projected successfully');
  } finally {
    await app.close();
  }
}

await main();
