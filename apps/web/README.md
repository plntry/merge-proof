# MergeProof web app

The Next.js app provides the local review flow: create an analysis, follow the
four agent states, inspect findings and trace data, and accept, reject, edit, or
reset findings. Progress arrives over SSE from authoritative persisted snapshots.
The stream sends an immediate snapshot on reconnect and stops after a terminal
analysis state.

Configure `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_DEMO_ORGANIZATION_ID` in `.env.local` (copy `.env.example`). The
OpenAI key stays in `apps/api/.env` and is never exposed to the browser.

From the repository root, start dependencies with `docker compose up -d`, then
run `pnpm dev:api` and `pnpm dev:web` in separate terminals. See the root
[README](../../README.md) for migrations, demo seeding, and checks.
