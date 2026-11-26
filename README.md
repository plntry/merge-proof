# MergeProof

MergeProof is an auditable, multi-agent pull-request review system. Specialized AI
agents identify potential requirements, security, architecture, and test-coverage
problems; deterministic application code turns those findings into an explainable
merge decision.

The core principle is simple:

> The model finds potential issues. Humans can review them. Deterministic code
> decides whether a change is ready to merge.

## Why MergeProof?

AI code review is useful, but a single opaque prompt should not decide whether a
pull request ships. MergeProof separates probabilistic analysis from durable
workflow state and deterministic policy:

- four focused agents inspect the same pull request independently;
- repository access is limited to typed, audited tools;
- raw model output and normalized findings are preserved separately;
- human reviewers can accept, reject, or edit findings without destroying the
  original AI evidence;
- merge readiness is calculated from explicit, testable rules;
- retries reuse completed work instead of paying for the same model call again;
- traces and fixture-based evals make quality and regressions measurable.

## How it works

```text
POST /reviews
      │
      ▼
PostgreSQL transaction ──► transactional outbox
      │
      ▼
BullMQ / AnalysisProcessor
      │
      ▼
AnalysisOrchestrator
      │
      ├── RequirementsAgent
      ├── SecurityAgent
      ├── ArchitectureAgent
      └── TestAgent
              │
              ▼
       controlled repository tools
              │
              ▼
Agent runs + tool calls + original findings
              │
              ▼
Human review ──► effective findings
              │
              ▼
Deterministic MergeDecisionEngine
              │
              ▼
READY / NEEDS_REVIEW / BLOCKED
              │
              ▼
Trace summary + deterministic evals
```

### Durable workflow

Review creation persists the review, analysis run, credit consumption, and outbox
event transactionally. BullMQ processes the analysis with retries and exponential
backoff. Each specialist has an independent `agent_run`, so partial failures do not
erase successful work and completed output can be safely reused.

### Controlled tool calling

Agents do not receive shell, database, environment, filesystem, or arbitrary HTTP
access. They can only call the registered repository tools:

- `getPRMetadata`
- `getChangedFiles`
- `getFileContent`
- `searchRepository`

Every call is permission-checked, scoped to the pull request, bounded by size and
time limits, and persisted in `tool_calls`.

### Human review and immutable evidence

`agent_runs.output` and `findings` remain original AI evidence. Human judgment is
stored separately in `finding_reviews`:

- **accepted** — use the original finding at full severity weight;
- **rejected** — preserve it for audit, but exclude it from risk;
- **edited** — use the human-edited title, description, and severity;
- **reset** — delete the review and return the finding to `unreviewed`.

Finding identity is stable across reprojection through
`(agent_run_id, source_index)`, so a retry cannot orphan a human review.

## Deterministic merge decisions

The LLM never calculates the final merge decision. `MergeDecisionEngine` is pure
TypeScript with no NestJS, PostgreSQL, Redis, BullMQ, or OpenAI dependency.

| Severity | Weight |
| --- | ---: |
| Low | 5 |
| Medium | 15 |
| High | 30 |
| Critical | 50 |

For an unreviewed finding:

```text
risk contribution = severity weight × confidence
```

Accepted and edited findings use the full effective-severity weight. Rejected
findings contribute zero. The total is rounded to the nearest integer and clamped
to `0..100`.

| Decision | Deterministic conditions |
| --- | --- |
| `blocked` | Human-confirmed critical finding, unreviewed critical confidence ≥ 0.90, or risk score ≥ 70 |
| `needs_review` | Required agent failed, unreviewed critical, unreviewed high confidence ≥ 0.60, or risk score ≥ 30 |
| `ready` | All required agents completed and no block/review rule applies |

Every non-ready result includes stable reason codes and references to the relevant
finding and agent where applicable.

## Tracing and evals

The analysis-run ID is also the logical trace ID. Compact trace events capture
analysis, agent, model-request, tool, finding-projection, and assessment boundaries.
The trace summary reports durations, attempts, retries, executed versus reused
agents, findings, tool/model calls, severity counts, and actual token usage when the
provider supplies it. Missing token usage remains explicitly unknown—MergeProof
does not estimate it.

Prompt versions are explicit:

```text
requirements-v1
security-v1
architecture-v1
tests-v1
```

The default eval suite uses six golden fixtures, scripted fake model responses, and
real deterministic application logic. It covers false positives, false negatives,
tool behavior, all agent categories, all merge decisions, and a human-review
decision change.

```bash
pnpm eval
```

The command makes no OpenAI API calls and exits non-zero on regression.

## Tech stack

- **API:** NestJS, TypeScript, Zod, class-validator
- **Workflow:** BullMQ + Redis, transactional outbox
- **Persistence:** PostgreSQL
- **AI:** OpenAI Responses API with structured outputs and function tools
- **Testing:** Vitest, Supertest, deterministic fake model responses
- **Web scaffold:** Next.js, React, Tailwind CSS
- **Workspace:** pnpm monorepo

## Repository layout

```text
merge-proof/
├── apps/
│   ├── api/
│   │   ├── evals/          # deterministic golden fixtures and runner
│   │   ├── migrations/     # ordered PostgreSQL migrations
│   │   ├── src/            # NestJS application and worker
│   │   └── test/           # e2e tests
│   └── web/                # Next.js scaffold
├── docs/
├── evals/
└── packages/
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 12
- PostgreSQL
- Redis on `localhost:6379`
- an OpenAI API key for real analyses

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
```

Required values:

```dotenv
DATABASE_URL=postgresql://localhost:5432/mergeproof
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=your_responses_api_model
PORT=3001
```

The deterministic unit tests and `pnpm eval` do not require a real OpenAI call.

### 3. Create and migrate a fresh database

```bash
createdb mergeproof

for migration in apps/api/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
```

Migrations are plain SQL and must be applied in numeric order.

For local use, create an organization before submitting a review:

```sql
INSERT INTO organizations (id, name, credits)
VALUES ('00000000-0000-4000-8000-000000000001', 'Local', 100);
```

### 4. Start Redis and the API

```bash
redis-server
pnpm dev:api
```

The API listens on `http://localhost:3001` by default. The current repository source
is a deterministic fixture for repository `merge-proof`, pull request `42`.

### 5. Create an analysis

```bash
curl -X POST http://localhost:3001/reviews \
  -H 'content-type: application/json' \
  -d '{
    "organizationId": "00000000-0000-4000-8000-000000000001",
    "repository": "merge-proof",
    "pullRequestNumber": 42
  }'
```

The response includes the review. The associated analysis runs asynchronously
through the outbox and BullMQ worker.

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/reviews` | Create a review and enqueue analysis |
| `GET` | `/reviews` | List reviews |
| `GET` | `/reviews/:id` | Read a review |
| `GET` | `/analysis-runs/:id/findings` | Original, reviewed, and effective findings |
| `GET` | `/analysis-runs/:id/assessment` | Current deterministic merge assessment |
| `GET` | `/analysis-runs/:id/trace` | Sanitized trace summary and events |
| `PATCH` | `/findings/:findingId/review` | Accept, reject, or edit a finding |
| `DELETE` | `/findings/:findingId/review` | Reset a finding to unreviewed |

Example review mutation:

```bash
curl -X PATCH http://localhost:3001/findings/FINDING_ID/review \
  -H 'content-type: application/json' \
  -d '{
    "status": "rejected",
    "note": "The authorization check is enforced by middleware."
  }'
```

The merge assessment is recalculated automatically in the same transaction.

## Development commands

```bash
# API development server
pnpm dev:api

# Web development server
pnpm dev:web

# Deterministic regression suite
pnpm eval

# Backend checks
pnpm --filter api build
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e

# Web checks
pnpm --filter web lint
pnpm --filter web build
```

E2E tests require local PostgreSQL and Redis. They seed and clean their own fixture
rows. Unit tests and evals use deterministic fakes at external boundaries.

## Audit model

MergeProof keeps each layer distinct:

```text
analysis_runs       durable workflow state
agent_runs          raw specialist outputs and model identity
tool_calls          scoped tool audit trail
findings            immutable normalized AI evidence
finding_reviews     human judgment
merge_assessments   deterministic product decision
trace_events        compact execution telemetry
```

This separation makes failures, retries, model changes, human overrides, and policy
decisions independently inspectable.

## Current limitations

- Repository data currently comes from a deterministic local fixture; a production
  GitHub provider is not implemented yet.
- Authentication and reviewer identity are not implemented.
- The Next.js app is currently a scaffold; the product UI and live updates are not
  part of the backend milestone.
- Tracing is database-backed and intentionally does not depend on an external
  observability platform.
- Eval quality checks are deterministic; there is no LLM-as-judge dependency.

For backend implementation details, see [apps/api/README.md](apps/api/README.md).
