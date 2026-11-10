import crypto from 'crypto';
import { pool } from '../config/db';
import { SyncService } from '../services/syncService';

async function seed() {
  console.log('Seeding demo data into public database...');

  const seedProducts = [
    { name: 'Mezan Banaspati Ghee (5L)', unit: 'Tin', costPaisa: 252000, pricePaisa: 268000, stock: 18, minStock: 5 },
    { name: 'Tapal Danedar Tea (450g)', unit: 'Pack', costPaisa: 68000, pricePaisa: 74000, stock: 15, minStock: 10 },
    { name: 'Guard Basmati Rice (10kg)', unit: 'Bag', costPaisa: 345000, pricePaisa: 380000, stock: 24, minStock: 8 },
    { name: 'Dal Channa Special (1kg)', unit: 'KG', costPaisa: 24000, pricePaisa: 27500, stock: 30, minStock: 15 },
    { name: "Olper's Milk (1L Pack)", unit: 'Pack', costPaisa: 27000, pricePaisa: 29000, stock: 48, minStock: 12 },
    { name: 'Cheeni White Refined (1kg)', unit: 'KG', costPaisa: 13200, pricePaisa: 14500, stock: 65, minStock: 20 }
  ];

  for (const p of seedProducts) {
    const prodId = crypto.randomUUID();
    const pRes = await SyncService.processSync({
      operationId: crypto.randomUUID(),
      type: 'PRODUCT_UPSERT',
      payload: {
        id: prodId,
        name: p.name,
        baseUnit: p.unit,
        purchasePricePaisa: p.costPaisa,
        salePricePaisa: p.pricePaisa,
        lowStockThresholdBase: p.minStock
      },
      createdAt: new Date().toISOString()
    });
    console.log('Product', p.name, '->', pRes.data);

    const sRes = await SyncService.processSync({
      operationId: crypto.randomUUID(),
      type: 'STOCK_PURCHASE',
      payload: {
        id: crypto.randomUUID(),
        productId: prodId,
        quantityBase: p.stock,
        unitCostPaisa: p.costPaisa,
        reason: 'Opening stock inventory'
      },
      createdAt: new Date().toISOString()
    });
    console.log('Stock purchase for', p.name, '->', sRes.data);
  }

  const seedCustomers = [
    { name: 'Chaudhry Bashir', phone: '0300-8541290', balancePaisa: 1480000 },
    { name: 'Bhai Tariq', phone: '0301-8847291', balancePaisa: 645000 },
    { name: 'Rashid Khan', phone: '0333-5129044', balancePaisa: 2120000 },
    { name: 'Master Zahid', phone: '0345-7821903', balancePaisa: 320000 }
  ];

  for (const c of seedCustomers) {
    const custId = crypto.randomUUID();
    const cRes = await SyncService.processSync({
      operationId: crypto.randomUUID(),
      type: 'CUSTOMER_UPSERT',
      payload: {
        id: custId,
        name: c.name,
        phone: c.phone,
        openingBalancePaisa: c.balancePaisa,
        creditLimitPaisa: 2500000
      },
      createdAt: new Date().toISOString()
    });
    console.log('Customer', c.name, '->', cRes.data);
  }

  console.log('Seed completed successfully!');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
