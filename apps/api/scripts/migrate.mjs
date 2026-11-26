import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadLocalEnv } from './load-local-env.mjs';

const { Pool } = pg;
loadLocalEnv();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString });
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const files = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
  const history = await pool.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
  const existingSchema = await pool.query(`SELECT to_regclass('public.trace_events') IS NOT NULL AS exists`);
  if (history.rows[0].count === 0 && existingSchema.rows[0].exists) {
    const legacyBaseline = files.filter((name) => name <= '014_create_trace_events.sql');
    await pool.query('INSERT INTO schema_migrations (name) SELECT unnest($1::text[])', [legacyBaseline]);
    process.stdout.write('Recorded migrations for an existing MergeProof schema.\n');
  }
  const partialSchema = await pool.query(`SELECT to_regclass('public.reviews') IS NOT NULL AS exists`);
  if (history.rows[0].count === 0 && partialSchema.rows[0].exists && !existingSchema.rows[0].exists) {
    throw new Error('A partial schema without migration history was found. Restore the prior migration sequence before continuing.');
  }
  for (const name of files) {
    const alreadyApplied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (alreadyApplied.rowCount) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(await readFile(path.join(directory, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      process.stdout.write(`Applied ${name}\n`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
