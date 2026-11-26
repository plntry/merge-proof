import pg from 'pg';
import { loadLocalEnv } from './load-local-env.mjs';

const { Pool } = pg;
loadLocalEnv();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString });
try {
  await pool.query(
    `INSERT INTO organizations (id, name, credits)
     VALUES ($1, 'MergeProof Local Demo', 100)
     ON CONFLICT (id) DO NOTHING`,
    ['00000000-0000-4000-8000-000000000001'],
  );
  process.stdout.write('Demo organization is ready.\n');
} finally {
  await pool.end();
}
