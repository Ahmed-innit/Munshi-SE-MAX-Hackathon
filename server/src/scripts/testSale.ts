import { SyncService } from '../services/syncService';
import { pool } from '../config/db';

async function testSale() {
  const opId = crypto.randomUUID();
  console.log('Sending SALE_UDHAAR for Ali (2kg Chawal)...');
  const res = await SyncService.processSync({
    operationId: opId,
    type: 'SALE_UDHAAR',
    payload: {
      id: crypto.randomUUID(),
      customerId: '00000000-0000-4000-8000-000000000101', // Ali
      lines: [{
        productId: '00000000-0000-4000-8000-000000000001', // Basmati Chawal
        quantityBase: 2,
        unitPricePaisa: 30000,
        totalPaisa: 60000,
        productName: 'Basmati Chawal'
      }],
      totalPaisa: 60000,
      paymentMethod: 'UDHAAR'
    },
    createdAt: new Date().toISOString()
  });
  console.log('Sync Response Status:', res.data.status);

  const balRes = await pool.query(`
    SELECT name, (SELECT COALESCE(SUM(amount_paisa), 0) FROM ledger_entries WHERE customer_id = c.id) as debit 
    FROM customers c 
    WHERE id = '00000000-0000-4000-8000-000000000101'
  `);
  console.log('Ali Ledger in DB (debit paisa):', balRes.rows[0]);

  const stockRes = await pool.query(`
    SELECT name, (SELECT COALESCE(SUM(quantity_base), 0) FROM stock_movements WHERE product_id = p.id) as current_stock 
    FROM products p 
    WHERE id = '00000000-0000-4000-8000-000000000001'
  `);
  console.log('Chawal Stock in DB:', stockRes.rows[0]);

  await pool.end();
}

testSale().catch(console.error);
