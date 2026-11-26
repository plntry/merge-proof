import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');

export function loadLocalEnv() {
  try {
    process.loadEnvFile(envPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
