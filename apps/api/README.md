<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

MergeProof is a NestJS service that analyzes pull requests and persists
structured, auditable merge-readiness findings.

## Multi-agent analysis

```text
AnalysisProcessor
        ↓
AnalysisOrchestrator
        ↓
┌──────────────┬──────────┬──────────────┬─────────┐
Requirements   Security   Architecture   Tests
└──────────────┴──────────┴──────────────┴─────────┘
        ↓
AgentRuns + ToolCalls
        ↓
Original Findings
        ↓
Human Review
        ↓
Effective Findings
        ↓
MergeDecisionEngine
        ↓
Merge Assessment
```

The requirements agent compares product intent with implementation, the security
agent evaluates concrete trust-boundary regressions, the architecture agent checks
meaningful system-boundary and durability risks, and the test agent identifies
specific unverified changed behavior. They share one Responses API tool-calling
runner and one validated finding schema, but each has its own evidence-focused
prompt.

All agents may use `getChangedFiles`, `getFileContent`, and `searchRepository`.
Requirements, security, and tests may also use `getPRMetadata`; architecture may
not. The runner exposes only allowed tools, and `ToolRegistry` independently
enforces the permission before deterministic execution. The model never receives
filesystem, shell, database, environment, or arbitrary HTTP access. Calls are
scoped to the review and recorded in `tool_calls` under the calling agent run.

Day 3 uses a local `RepositorySource` fixture for `merge-proof` pull request 42.
A GitHub-backed source can replace that provider without changing the agent or
registry contracts.

Repository data sent to the model is bounded: searches accept 200 characters
and return at most 20 results with 500-character snippets; changed-file lists
return at most 100 entries; file content is capped at 20,000 characters; and a
serialized tool result cannot exceed 50,000 characters. Each agent stops after
five tool-call response rounds, and each tool execution has a 10-second limit.

Agents execute concurrently and persist independent `agent_runs`. Completed runs
are never sent to OpenAI again; retries validate their stored output and rebuild
their normalized findings. Failed agents can retry without erasing successful
agents. Full success completes the analysis. Final-attempt partial success becomes
`needs_review`, while final-attempt total failure becomes `failed`.

## Deterministic merge assessment

The LLM identifies potential issues, but it never calculates merge readiness.
`MergeDecisionEngine` is pure TypeScript and produces an integer risk score,
deterministic reason codes, a summary, and one of three decisions:

- `ready`: all required agents completed and no block or review rule applies.
- `needs_review`: agent coverage is incomplete, a finding needs review, or the
  risk score is at least 30.
- `blocked`: a human-confirmed critical finding exists, an unreviewed critical
  finding has confidence of at least 0.90, or the risk score is at least 70.

Severity weights are low 5, medium 15, high 30, and critical 50. Unreviewed
findings contribute `weight × confidence`; the total is summed, clamped to
0–100, and rounded to the nearest integer. Accepted and edited findings use the
full effective-severity weight. Rejected findings contribute zero. An
unreviewed high finding with confidence of at least 0.60 requires review.

Human reviewers use `PATCH /findings/:findingId/review` to accept, reject, or
edit a finding, and `DELETE /findings/:findingId/review` to reset it to
unreviewed. Every mutation recalculates the assessment transactionally. Read
the current product state through `GET /analysis-runs/:id/findings` and
`GET /analysis-runs/:id/assessment`.

Original evidence is immutable and remains distinct from human judgment:

```text
agent_runs.output   raw AI audit data
findings            normalized original AI findings
finding_reviews     human judgment and optional edited content
merge_assessments   deterministic current product decision
```

Findings use `(agent_run_id, source_index)` as their stable projection identity.
Re-projecting a completed agent output reuses existing rows, so finding IDs and
their human reviews survive retries.

Apply SQL migrations in numeric order before running the worker. Migration 011
creates the `tool_calls` audit table, migration 012 adds stable finding
positions and human reviews, and migration 013 creates merge assessments.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
