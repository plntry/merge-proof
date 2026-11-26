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

### 2. Start local infrastructure and configure the applications

```bash
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Required values:

```dotenv
DATABASE_URL=postgresql://mergeproof:mergeproof@localhost:5432/mergeproof
OPENAI_API_KEY=your_server_side_api_key
OPENAI_MODEL=gpt-4.1-mini
PORT=3001
WEB_ORIGIN=http://localhost:3000
REPOSITORY_SOURCE=fixture
```

Keep the OpenAI key in the API environment. Unit tests and `pnpm eval` do not call
OpenAI; submitting an analysis from the app does use the configured model.

### 3. Create and migrate a fresh database

```bash
pnpm migrate
pnpm seed:demo
```

The migration command applies numbered SQL migrations in order and records them
in `schema_migrations`. It also recognizes databases created by the former manual
migration instructions. The seed creates the local organization used by the UI.

### 4. Run the applications

```bash
pnpm dev:api
# in another terminal
pnpm dev:web
```

The product UI creates a review and receives persisted progress snapshots over
SSE. The fixture repository source is selected by default. `GET /health` checks
PostgreSQL connectivity.

To use GitHub instead of the fixture, set `REPOSITORY_SOURCE=github` and add a
server-side `GITHUB_TOKEN` with access to the target repositories. The token is
never sent to the web app. File reads use the PR head SHA; changed-file retrieval
is paginated and capped at 100 files, file content at 20,000 characters, and code
search at 20 bounded snippets. Requests time out after five seconds and GitHub
errors are converted to controlled tool errors. No GitHub request is made in the
default fixture mode.

### 5. Checks

```bash
pnpm test
pnpm test:e2e
pnpm test:web
pnpm eval
pnpm lint
pnpm build
```

### 6. Create an analysis

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
| `GET` | `/analysis-runs/:id/events` | SSE stream of authoritative analysis snapshots |
| `GET` | `/analysis-runs/:id/trace` | Sanitized trace summary and events |
| `GET` | `/health` | PostgreSQL readiness check |
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
rows. Web API client tests use mocked fetch/EventSource. Unit tests and evals use
deterministic fakes at external boundaries.

For an end-to-end browser smoke test without contacting OpenAI, run
`pnpm --filter api dev:fake-responses`, then start the API with
`OPENAI_BASE_URL=http://127.0.0.1:4010/v1`, a dummy `OPENAI_API_KEY`, and
`REPOSITORY_SOURCE=fixture`. The fake server binds to loopback and returns fixed
findings; it has no upstream API connection.

## Audit model

MergeProof keeps each layer distinct:

```text
analysis_runs       durable workflow state
agent_runs          raw specialist outputs, model identity, and fenced leases
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
  GitHub provider is available by explicit server-side configuration, while the
  fixture remains the default for tests and local demo.
- Authentication and reviewer identity are not implemented.
- Tracing is database-backed and intentionally does not depend on an external
  observability platform.
- Eval quality checks are deterministic; there is no LLM-as-judge dependency.

For backend implementation details, see [apps/api/README.md](apps/api/README.md).
