import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function executeSqlFile(pool: Pool, filePath: string): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const sql = await readFile(absolutePath, 'utf-8');
  await pool.query(sql);
  console.log(`✓ Executed: ${filePath}`);
}

async function main(): Promise<void> {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not configured.');
  }

  const pool = new Pool({
    connectionString: postgresUrl,
  });

  try {
    console.log('🗑️  Dropping all tables...');
    await executeSqlFile(pool, 'infra/sql/drop_all.sql');

    console.log('🏗️  Creating tables and seeding data...');
    await executeSqlFile(pool, 'infra/sql/000_init_and_seed.sql');

    console.log('✅ Database reset completed successfully!');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to reset database', error);
  process.exit(1);
});
