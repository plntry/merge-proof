import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import { AppModule } from './../src/app.module.js';
import { DATABASE_POOL } from '../src/database/database.constants.js';
import { MergeAssessmentService } from '../src/analysis-runs/merge-assessment/merge-assessment.service.js';
import { FindingProjectionService } from '../src/analysis-runs/findings/finding-projection.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let pool: Pool;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    pool = app.get<Pool>(DATABASE_POOL);
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('recalculates deterministically after review and preserves review on reprojection', async () => {
    const organizationId = randomUUID();
    const reviewId = randomUUID();
    const analysisRunId = randomUUID();
    const agentRunIds = {
      requirements: randomUUID(),
      security: randomUUID(),
      architecture: randomUUID(),
      tests: randomUUID(),
    };
    const findingId = randomUUID();
    const toolCallId = randomUUID();
    const rawOutput = {
      findings: [
        {
          title: 'Missing authorization check',
          description:
            'The changed service bypasses an authorization boundary.',
          severity: 'critical',
          confidence: 0.95,
        },
      ],
    };

    try {
      await pool.query(
        `INSERT INTO organizations (id, name, credits) VALUES ($1, $2, $3);`,
        [organizationId, 'Day 5 e2e', 10],
      );
      await pool.query(
        `INSERT INTO reviews (
           id, repository, pull_request_number, status, organization_id
         ) VALUES ($1, $2, $3, $4, $5);`,
        [reviewId, 'merge-proof', 5005, 'completed', organizationId],
      );
      await pool.query(
        `INSERT INTO analysis_runs (id, review_id, status)
         VALUES ($1, $2, $3);`,
        [analysisRunId, reviewId, 'completed'],
      );

      for (const [agentType, agentRunId] of Object.entries(agentRunIds)) {
        await pool.query(
          `INSERT INTO agent_runs (
             id, analysis_run_id, agent_type, status, model, output
           ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            agentRunId,
            analysisRunId,
            agentType,
            'completed',
            'deterministic-e2e-fixture',
            agentType === 'security' ? rawOutput : { findings: [] },
          ],
        );
      }

      await pool.query(
        `INSERT INTO tool_calls (
           id, agent_run_id, tool_name, arguments, result, status,
           started_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), NOW());`,
        [
          toolCallId,
          agentRunIds.security,
          'getChangedFiles',
          { repository: 'sensitive-internal-value' },
          { files: ['sensitive-source.ts'] },
        ],
      );
      const traceEvents = [
        ['analysis.started', null, null, { attempt: 1, maxAttempts: 3 }],
        [
          'agent.started',
          agentRunIds.security,
          null,
          { agentType: 'security', promptVersion: 'security-v1' },
        ],
        [
          'model.request.started',
          agentRunIds.security,
          null,
          { requestIndex: 0, model: 'deterministic-e2e-fixture' },
        ],
        [
          'model.request.completed',
          agentRunIds.security,
          null,
          {
            requestIndex: 0,
            model: 'deterministic-e2e-fixture',
            durationMs: 12,
            inputTokens: 20,
            outputTokens: 5,
            totalTokens: 25,
          },
        ],
        [
          'tool.completed',
          agentRunIds.security,
          toolCallId,
          { agentType: 'security', toolName: 'getChangedFiles', durationMs: 3 },
        ],
        [
          'agent.completed',
          agentRunIds.security,
          null,
          { agentType: 'security', findingCount: 1, durationMs: 20 },
        ],
      ] as const;
      for (const [
        eventType,
        agentRunId,
        eventToolCallId,
        metadata,
      ] of traceEvents) {
        await pool.query(
          `INSERT INTO trace_events (
             id, analysis_run_id, agent_run_id, tool_call_id, event_type, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6);`,
          [
            randomUUID(),
            analysisRunId,
            agentRunId,
            eventToolCallId,
            eventType,
            metadata,
          ],
        );
      }

      await pool.query(
        `INSERT INTO findings (
           id, analysis_run_id, agent_run_id, source_index,
           title, description, severity, confidence
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          findingId,
          analysisRunId,
          agentRunIds.security,
          0,
          rawOutput.findings[0].title,
          rawOutput.findings[0].description,
          rawOutput.findings[0].severity,
          rawOutput.findings[0].confidence,
        ],
      );

      await app.get(MergeAssessmentService).recalculate(analysisRunId);

      const initialAssessment = await request(app.getHttpServer())
        .get(`/analysis-runs/${analysisRunId}/assessment`)
        .expect(200);
      expect(initialAssessment.body).toMatchObject({
        analysisRunId,
        decision: 'blocked',
        riskScore: 48,
      });

      await request(app.getHttpServer())
        .patch(`/findings/${findingId}/review`)
        .send({
          status: 'rejected',
          note: 'The authorization check exists in middleware.',
        })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/findings/${findingId}/review`)
        .send({ status: 'edited' })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/findings/${findingId}/review`)
        .send({
          status: 'edited',
          editedFinding: {
            title: 'Edited title',
            description: 'Edited description',
            severity: 'urgent',
          },
        })
        .expect(400);

      const updatedAssessment = await request(app.getHttpServer())
        .get(`/analysis-runs/${analysisRunId}/assessment`)
        .expect(200);
      expect(updatedAssessment.body).toMatchObject({
        analysisRunId,
        decision: 'ready',
        riskScore: 0,
        summary: { activeFindings: 0, rejectedFindings: 1 },
      });
      const assessmentCount = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM merge_assessments
         WHERE analysis_run_id = $1;`,
        [analysisRunId],
      );
      expect(assessmentCount.rows[0].count).toBe('1');

      await app
        .get(FindingProjectionService)
        .projectAgentOutput(analysisRunId, agentRunIds.security, rawOutput);

      const findings = await request(app.getHttpServer())
        .get(`/analysis-runs/${analysisRunId}/findings`)
        .expect(200);
      expect(findings.body).toEqual([
        expect.objectContaining({
          id: findingId,
          agentType: 'security',
          original: expect.objectContaining({
            title: rawOutput.findings[0].title,
            severity: 'critical',
            confidence: 0.95,
          }),
          review: expect.objectContaining({ status: 'rejected' }),
          effective: expect.objectContaining({
            severity: 'critical',
            excluded: true,
          }),
        }),
      ]);

      const agentOutput = await pool.query<{ output: unknown }>(
        `SELECT output FROM agent_runs WHERE id = $1;`,
        [agentRunIds.security],
      );
      expect(agentOutput.rows[0].output).toEqual(rawOutput);

      const trace = await request(app.getHttpServer())
        .get(`/analysis-runs/${analysisRunId}/trace`)
        .expect(200);
      expect(trace.body.summary).toMatchObject({
        analysisRunId,
        attempts: 0,
        totals: {
          modelCalls: 1,
          toolCalls: 1,
          findings: 1,
          inputTokens: 20,
          outputTokens: 5,
          totalTokens: 25,
          usageComplete: true,
        },
      });
      expect(trace.body.summary.agents).toContainEqual(
        expect.objectContaining({
          agentType: 'security',
          promptVersion: 'security-v1',
          modelCallCount: 1,
          toolCallCount: 1,
          findingCount: 1,
        }),
      );
      const serializedTrace = JSON.stringify(trace.body);
      expect(serializedTrace).not.toContain('sensitive-internal-value');
      expect(serializedTrace).not.toContain('sensitive-source.ts');
      expect(serializedTrace).not.toContain('instructions');
    } finally {
      await pool.query(`DELETE FROM trace_events WHERE analysis_run_id = $1;`, [
        analysisRunId,
      ]);
      await pool.query(`DELETE FROM tool_calls WHERE id = $1;`, [toolCallId]);
      await pool.query(
        `DELETE FROM merge_assessments WHERE analysis_run_id = $1;`,
        [analysisRunId],
      );
      await pool.query(`DELETE FROM finding_reviews WHERE finding_id = $1;`, [
        findingId,
      ]);
      await pool.query(`DELETE FROM findings WHERE analysis_run_id = $1;`, [
        analysisRunId,
      ]);
      await pool.query(`DELETE FROM agent_runs WHERE analysis_run_id = $1;`, [
        analysisRunId,
      ]);
      await pool.query(`DELETE FROM analysis_runs WHERE id = $1;`, [
        analysisRunId,
      ]);
      await pool.query(`DELETE FROM reviews WHERE id = $1;`, [reviewId]);
      await pool.query(`DELETE FROM organizations WHERE id = $1;`, [
        organizationId,
      ]);
    }
  });

  it('returns 404 for an unknown analysis trace', () =>
    request(app.getHttpServer())
      .get(`/analysis-runs/${randomUUID()}/trace`)
      .expect(404));

  afterAll(async () => {
    await app.close();
  });
});
