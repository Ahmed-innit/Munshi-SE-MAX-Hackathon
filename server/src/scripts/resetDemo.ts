import { pool } from '../config/db';

export async function resetDemo() {
  const isConfirmed = process.argv.includes('--confirm');
  if (!isConfirmed) {
    console.error('Error: reset-demo requires --confirm flag to truncate tables. Aborted.');
    process.exit(1);
  }

  console.log('Resetting demo data tables with --confirm...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE 
        audit_log,
        processed_operations,
        sales,
        stock_movements,
        ledger_entries,
        customers,
        products
      CASCADE;
    `);
    await client.query('COMMIT');
    console.log('Demo data reset successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to reset demo data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module || process.argv[1]?.endsWith('resetDemo.ts')) {
  resetDemo().catch(() => process.exit(1));
}
