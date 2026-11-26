# MergeProof API

NestJS API and BullMQ worker for the durable multi-agent PR review workflow.
Application architecture, configuration, API routes, migrations, and local
development are documented in the repository [README](../../README.md).

Useful commands from the repository root:

```bash
pnpm --filter api start:dev
pnpm migrate
pnpm seed:demo
pnpm --filter api test
pnpm test:e2e
pnpm eval
```

The API validates its environment at startup. Keep `OPENAI_API_KEY` in the API
environment only. Evals and unit tests use deterministic data and do not call
OpenAI.
