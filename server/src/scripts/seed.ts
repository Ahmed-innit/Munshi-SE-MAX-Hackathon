import crypto from 'crypto';
import { pool } from '../config/db';
import { SyncService } from '../services/syncService';

async function seed() {
  console.log('--- SEEDING OFFICIAL SRS §1.5 DATASET ---');

  // Truncate tables first so testing starts from known fresh state
  const client = await pool.connect();
  try {
    await client.query(`
      TRUNCATE TABLE 
        audit_log,
        processed_operations,
        ledger_entries,
        stock_movements,
        sales,
        customers,
        products
      CASCADE;
    `);
    console.log('Tables truncated cleanly.');
  } finally {
    client.release();
  }

  // 10 Products from SRS Section 1.5
  const seedProducts = [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Basmati Chawal', unit: 'kg', costPaisa: 25000, pricePaisa: 30000, stock: 20, threshold: 5, aliases: ['chawal', 'rice'] },
    { id: '00000000-0000-4000-8000-000000000002', name: 'Aata', unit: 'kg', costPaisa: 12000, pricePaisa: 15000, stock: 50, threshold: 10, aliases: ['aata', 'flour'] },
    { id: '00000000-0000-4000-8000-000000000003', name: 'Cheeni', unit: 'kg', costPaisa: 16000, pricePaisa: 18000, stock: 30, threshold: 5, aliases: ['cheeni', 'sugar'] },
    { id: '00000000-0000-4000-8000-000000000004', name: 'Doodh', unit: 'litre', costPaisa: 18000, pricePaisa: 20000, stock: 20, threshold: 5, aliases: ['doodh', 'milk'] },
    { id: '00000000-0000-4000-8000-000000000005', name: 'Coke bottle', unit: 'piece', costPaisa: 8000, pricePaisa: 10000, stock: 48, threshold: 12, aliases: ['coke', 'bottle'] },
    { id: '00000000-0000-4000-8000-000000000006', name: 'Sabun packet', unit: 'packet', costPaisa: 10000, pricePaisa: 12000, stock: 30, threshold: 6, aliases: ['sabun', 'soap'] },
    { id: '00000000-0000-4000-8000-000000000007', name: 'Dal Channa Special', unit: 'kg', costPaisa: 24000, pricePaisa: 27500, stock: 30, threshold: 15, aliases: ['dal', 'daal'] },
    { id: '00000000-0000-4000-8000-000000000008', name: 'Mezan Banaspati Ghee', unit: 'tin', costPaisa: 252000, pricePaisa: 268000, stock: 18, threshold: 5, aliases: ['ghee', 'mezan'] },
    { id: '00000000-0000-4000-8000-000000000009', name: 'Tapal Danedar Tea', unit: 'pack', costPaisa: 68000, pricePaisa: 74000, stock: 15, threshold: 10, aliases: ['tea', 'tapal', 'chai'] },
    { id: '00000000-0000-4000-8000-000000000010', name: "Olper's Milk", unit: 'pack', costPaisa: 27000, pricePaisa: 29000, stock: 48, threshold: 12, aliases: ['olpers', 'milk pack'] }
  ];

  for (const p of seedProducts) {
    await SyncService.processSync({
      operationId: crypto.randomUUID(),
      type: 'PRODUCT_UPSERT',
      payload: {
        id: p.id,
        name: p.name,
        aliases: p.aliases,
        baseUnit: p.unit,
        purchasePricePaisa: p.costPaisa,
        salePricePaisa: p.pricePaisa,
        lowStockThresholdBase: p.threshold
      },
      createdAt: new Date().toISOString()
    });

    if (p.stock > 0) {
      await SyncService.processSync({
        operationId: crypto.randomUUID(),
        type: 'STOCK_PURCHASE',
        payload: {
          id: crypto.randomUUID(),
          productId: p.id,
          quantityBase: p.stock,
          unitCostPaisa: p.costPaisa,
          reason: 'Initial starting stock'
        },
        createdAt: new Date().toISOString()
      });
    }
  }

  // 8 Customers from SRS Section 1.5
  const seedCustomers = [
    { id: '00000000-0000-4000-8000-000000000101', name: 'Ali', phone: '0300-1111111', balancePaisa: 0, limitPaisa: 500000 },
    { id: '00000000-0000-4000-8000-000000000102', name: 'Ahmed', phone: '0300-2222222', balancePaisa: 0, limitPaisa: 200000 },
    { id: '00000000-0000-4000-8000-000000000103', name: 'Ahmed Khan', phone: '0300-3333333', balancePaisa: 0, limitPaisa: 200000 },
    { id: '00000000-0000-4000-8000-000000000104', name: 'Bilal', phone: '0300-4444444', balancePaisa: 0, limitPaisa: 100000 },
    { id: '00000000-0000-4000-8000-000000000105', name: 'Chaudhry Bashir', phone: '0300-8541290', balancePaisa: 1480000, limitPaisa: 2000000 },
    { id: '00000000-0000-4000-8000-000000000106', name: 'Bhai Tariq', phone: '0301-8847291', balancePaisa: 645000, limitPaisa: 1500000 },
    { id: '00000000-0000-4000-8000-000000000107', name: 'Rashid Khan', phone: '0333-5129044', balancePaisa: 2120000, limitPaisa: 2500000 },
    { id: '00000000-0000-4000-8000-000000000108', name: 'Master Zahid', phone: '0345-7821903', balancePaisa: 320000, limitPaisa: 1000000 }
  ];

  for (const c of seedCustomers) {
    await SyncService.processSync({
      operationId: crypto.randomUUID(),
      type: 'CUSTOMER_UPSERT',
      payload: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        openingBalancePaisa: c.balancePaisa,
        creditLimitPaisa: c.limitPaisa
      },
      createdAt: new Date().toISOString()
    });
  }

  console.log('Seeded 10 products and 8 customers successfully into public database!');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
