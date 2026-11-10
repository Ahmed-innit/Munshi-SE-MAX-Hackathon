import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also ensure process.env is read if dotenv was called at process start
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment or server/.env');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

export const query = <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
