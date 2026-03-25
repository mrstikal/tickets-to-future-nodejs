import { readFile, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const MIGRATIONS_DIR = 'infra/migrations';

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY name ASC'
  );
  return new Set(result.rows.map((row) => row.name));
}

async function getPendingMigrations(): Promise<string[]> {
  const files = await readdir(path.resolve(process.cwd(), MIGRATIONS_DIR));
  return files
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function applyMigration(pool: Pool, migrationName: string): Promise<void> {
  const absolutePath = path.resolve(process.cwd(), MIGRATIONS_DIR, migrationName);
  const sql = await readFile(absolutePath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
    await client.query('COMMIT');
    console.log(`✓ Applied migration: ${migrationName}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Failed to apply migration: ${migrationName}`, error);
    throw error;
  } finally {
    client.release();
  }
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
    await ensureMigrationsTable(pool);
    const appliedMigrations = await getAppliedMigrations(pool);
    const pendingMigrations = await getPendingMigrations();

    let migrationsAppliedCount = 0;

    for (const migration of pendingMigrations) {
      if (!appliedMigrations.has(migration)) {
        await applyMigration(pool, migration);
        migrationsAppliedCount++;
      }
    }

    if (migrationsAppliedCount === 0) {
      console.log('✓ No pending migrations.');
    } else {
      console.log(`✅ Successfully applied ${migrationsAppliedCount} new migrations.`);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to run migrations', error);
  process.exit(1);
});
