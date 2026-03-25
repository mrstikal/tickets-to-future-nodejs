import * as path from 'node:path';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main(): Promise<void> {
  const postgresUrl = process.env.POSTGRES_URL;

  if (!postgresUrl) {
    throw new Error('POSTGRES_URL is not configured.');
  }

  const pool = new Pool({
    connectionString: postgresUrl,
  });

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash('Admin123!', 10);

    // Upsert admin user (insert or update password if exists)
    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         updated_at = now()`,
      ['admin@tickets.local', hashedPassword, 'admin', true]
    );

    console.log('Admin user created/updated successfully');
    console.log('Email: admin@tickets.local');
    console.log('Password: Admin123!');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to seed admin user', error);
  process.exit(1);
});