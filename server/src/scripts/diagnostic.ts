import { pool } from '../config/db';

async function main() {
  console.log('--- MUNSHI LIVE DB & BACKEND DIAGNOSTIC ---');
  const t0 = Date.now();
  const info = await pool.query('SELECT NOW() as current_time, current_database(), current_user;');
  console.log('Connected in:', Date.now() - t0, 'ms');
  console.log('Database:', info.rows[0].current_database);
  console.log('User:', info.rows[0].current_user);

  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Public Schema Tables:', tables.rows.map(r => r.table_name).join(', '));

  const counts = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM products) as products,
      (SELECT COUNT(*) FROM customers) as customers,
      (SELECT COUNT(*) FROM sales) as sales,
      (SELECT COUNT(*) FROM stock_movements) as stock_movements,
      (SELECT COUNT(*) FROM ledger_entries) as ledger_entries,
      (SELECT COUNT(*) FROM processed_operations) as processed_operations,
      (SELECT COUNT(*) FROM audit_log) as audit_log;
  `);
  console.log('Table Counts in public:', counts.rows[0]);

  await pool.end();
  console.log('Diagnostic finished cleanly.');
}

main().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
