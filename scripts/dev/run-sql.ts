import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const filePath = process.argv[2];

  if (!filePath) {
    throw new Error('SQL file path is required.');
  }

  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not configured.');
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  const sql = await readFile(absolutePath, 'utf-8');

  const pool = new Pool({
    connectionString: postgresUrl,
  });

  try {
    await pool.query(sql);
    console.log(`Executed SQL file: ${filePath}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to execute SQL file', error);
  process.exit(1);
});