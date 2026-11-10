import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env relative to server root
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config();
} else {
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
}

const connectionString = process.env.DATABASE_URL;

const dbSchema = process.env.DB_SCHEMA || (process.env.NODE_ENV === 'test' ? 'test' : undefined);

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      ...(dbSchema ? { options: `-c search_path=${dbSchema},public` } : {})
    })
  : (new Proxy({} as Pool, {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        return () => {
          throw new Error('DATABASE_URL is not set in environment or server/.env');
        };
      }
    }) as Pool);

export const query = <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
