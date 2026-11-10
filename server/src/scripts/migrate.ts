import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export async function runMigrations() {
  console.log('Running database migrations...');
  const migrationPath = path.resolve(__dirname, '../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 001_initial_schema.sql executed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Fatal migration error:', err);
      await pool.end();
      process.exit(1);
    });
}
