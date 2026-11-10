process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import { pool } from '../src/config/db';
import crypto from 'crypto';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // 1. Prepare test schema to ensure real data is NEVER written to
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS test;');
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../src/migrations/001_initial_schema.sql'),
      'utf8'
    );
    await client.query(migrationSql);
  } finally {
    client.release();
  }

  // 2. Start ephemeral test server
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  // Clean up test schema
  try {
    const client = await pool.connect();
    await client.query('DROP SCHEMA IF EXISTS test CASCADE;');
    client.release();
  } catch (err) {
    console.error('Error cleaning up test schema:', err);
  }
  await pool.end();
});

describe('Munshi Kiryana Sync & Endpoints API', { timeout: 35000 }, () => {
  // Helper to create a product in DB
  async function createProduct(initialStock = 0, name = 'Test Product') {
    const productId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO products (id, name, aliases, base_unit, pack_size, purchase_price_paisa, sale_price_paisa, low_stock_threshold_base)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [productId, name, ['test'], 'kg', 1, 10000, 12000, 2]
    );

    if (initialStock > 0) {
      const movementId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reason, sync_status)
         VALUES ($1, $2, 'PURCHASE', $3, 10000, 'Initial Stock Purchase', 'SYNCED')`,
        [movementId, productId, initialStock]
      );
    }

    return productId;
  }

  // Helper to create a customer in DB
  async function createCustomer(name = 'Test Customer', openingBalance = 0) {
    const customerId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO customers (id, name, phone, opening_balance_paisa, credit_limit_paisa)
       VALUES ($1, $2, $3, $4, $5)`,
      [customerId, name, '03001234567', openingBalance, 500000]
    );
    return customerId;
  }

  // Helper to get current stock from stock_movements
  async function getCurrentStock(productId: string): Promise<number> {
    const res = await pool.query(
      'SELECT COALESCE(SUM(quantity_base), 0) AS current_stock FROM stock_movements WHERE product_id = $1',
      [productId]
    );
    return parseInt(res.rows[0].current_stock, 10);
  }

  // Helper to get customer balance from ledger_entries
  async function getCustomerBalance(customerId: string): Promise<number> {
    const res = await pool.query(
      `SELECT 
        c.opening_balance_paisa + 
        COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount_paisa ELSE -l.amount_paisa END), 0) AS balance
       FROM customers c
       LEFT JOIN ledger_entries l ON l.customer_id = c.id
       WHERE c.id = $1
       GROUP BY c.id, c.opening_balance_paisa`,
      [customerId]
    );
    return parseInt(res.rows[0].balance, 10);
  }

  // -------------------------------------------------------------
  // HEALTH CHECK
  // -------------------------------------------------------------
  it('GET /api/health: should return 200 with database connected status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
    expect(data.timestamp).toBeDefined();
  });

  // -------------------------------------------------------------
  // TEST 1: FIRST SYNC
  // -------------------------------------------------------------
  it('1. first sync: should successfully process and persist a sale, stock movement, and audit log', async () => {
    const productId = await createProduct(10, 'Basmati Rice 1kg');
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();

    const payload = {
      id: saleId,
      lines: [
        {
          productId,
          quantityBase: 3,
          unitPricePaisa: 12000,
          totalPaisa: 36000
        }
      ],
      totalPaisa: 36000,
      paymentMethod: 'CASH'
    };

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        type: 'SALE_CASH',
        payload,
        createdAt: new Date().toISOString()
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      status: 'ok',
      operationId,
      duplicate: false
    });

    // Verify row exists in sales
    const saleRow = await pool.query('SELECT * FROM sales WHERE id = $1', [saleId]);
    expect(saleRow.rows.length).toBe(1);

    // Verify row exists in stock_movements (signed: -3)
    const moveRow = await pool.query('SELECT * FROM stock_movements WHERE reference_id = $1', [saleId]);
    expect(moveRow.rows.length).toBe(1);
    expect(moveRow.rows[0].quantity_base).toBe(-3);

    // Verify processed_operations
    const opRow = await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId]);
    expect(opRow.rows.length).toBe(1);
  });

  // -------------------------------------------------------------
  // TEST 2: REPLAY OF THE SAME OPERATION ID
  // -------------------------------------------------------------
  it('2. replay of the same operationId: returns duplicate: true and leaves exactly one row in every table', async () => {
    const productId = await createProduct(10, 'Cooking Oil 1L');
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();

    const syncBody = {
      operationId,
      type: 'SALE_CASH',
      payload: {
        id: saleId,
        lines: [
          {
            productId,
            quantityBase: 2,
            unitPricePaisa: 50000,
            totalPaisa: 100000
          }
        ],
        totalPaisa: 100000,
        paymentMethod: 'CASH'
      },
      createdAt: new Date().toISOString()
    };

    // First attempt
    const firstRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncBody)
    });
    expect(firstRes.status).toBe(200);
    const firstData = await firstRes.json();
    expect(firstData.duplicate).toBe(false);

    // Snapshot counts
    const salesBefore = (await pool.query('SELECT COUNT(*) FROM sales WHERE id = $1', [saleId])).rows[0].count;
    const movementsBefore = (await pool.query('SELECT COUNT(*) FROM stock_movements WHERE reference_id = $1', [saleId])).rows[0].count;
    const opsBefore = (await pool.query('SELECT COUNT(*) FROM processed_operations WHERE operation_id = $1', [operationId])).rows[0].count;

    // Second attempt (replay)
    const replayRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncBody)
    });
    expect(replayRes.status).toBe(200);
    const replayData = await replayRes.json();
    expect(replayData).toEqual({
      status: 'ok',
      operationId,
      duplicate: true
    });

    // Exactly one row remains in each table
    const salesAfter = (await pool.query('SELECT COUNT(*) FROM sales WHERE id = $1', [saleId])).rows[0].count;
    const movementsAfter = (await pool.query('SELECT COUNT(*) FROM stock_movements WHERE reference_id = $1', [saleId])).rows[0].count;
    const opsAfter = (await pool.query('SELECT COUNT(*) FROM processed_operations WHERE operation_id = $1', [operationId])).rows[0].count;

    expect(salesAfter).toBe('1');
    expect(movementsAfter).toBe('1');
    expect(opsAfter).toBe('1');
    expect(salesAfter).toBe(salesBefore);
    expect(movementsAfter).toBe(movementsBefore);
  });

  // -------------------------------------------------------------
  // TEST 3: NEGATIVE_STOCK REJECTION
  // -------------------------------------------------------------
  it('3. NEGATIVE_STOCK rejection: leaves nothing partly saved', async () => {
    const productId = await createProduct(1, 'Chawal');
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();

    // Available stock is 1; attempt to sell 2
    const syncBody = {
      operationId,
      type: 'SALE_CASH',
      payload: {
        id: saleId,
        lines: [
          {
            productId,
            quantityBase: 2,
            unitPricePaisa: 25000,
            totalPaisa: 50000
          }
        ],
        totalPaisa: 50000,
        paymentMethod: 'CASH'
      },
      createdAt: new Date().toISOString()
    };

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncBody)
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.status).toBe('rejected');
    expect(data.operationId).toBe(operationId);
    expect(data.code).toBe('NEGATIVE_STOCK');
    expect(data.reason).toMatch(/stock mein sirf 1/i);

    // Verify nothing partly saved
    const saleCheck = await pool.query('SELECT * FROM sales WHERE id = $1', [saleId]);
    expect(saleCheck.rows.length).toBe(0);

    const moveCheck = await pool.query('SELECT * FROM stock_movements WHERE reference_id = $1', [saleId]);
    expect(moveCheck.rows.length).toBe(0);

    const opCheck = await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId]);
    expect(opCheck.rows.length).toBe(0);

    // Stock unchanged
    const stock = await getCurrentStock(productId);
    expect(stock).toBe(1);
  });

  // -------------------------------------------------------------
  // TEST 4: UNKNOWN CUSTOMER & UNKNOWN PRODUCT REJECTIONS
  // -------------------------------------------------------------
  it('4. unknown customer and unknown product rejections', async () => {
    const validProductId = await createProduct(10, 'Ghee 1L');
    const nonExistentCustomerId = crypto.randomUUID();
    const nonExistentProductId = crypto.randomUUID();

    // 4a: Unknown Customer
    const custOpId = crypto.randomUUID();
    const custRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: custOpId,
        type: 'SALE_UDHAAR',
        payload: {
          id: crypto.randomUUID(),
          customerId: nonExistentCustomerId,
          lines: [{ productId: validProductId, quantityBase: 1, unitPricePaisa: 50000, totalPaisa: 50000 }],
          totalPaisa: 50000,
          paymentMethod: 'UDHAAR'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(custRes.status).toBe(400);
    const custData = await custRes.json();
    expect(custData.status).toBe('rejected');
    expect(custData.code).toBe('UNKNOWN_CUSTOMER');

    // 4b: Unknown Product
    const prodOpId = crypto.randomUUID();
    const prodRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: prodOpId,
        type: 'SALE_CASH',
        payload: {
          id: crypto.randomUUID(),
          lines: [{ productId: nonExistentProductId, quantityBase: 1, unitPricePaisa: 1000, totalPaisa: 1000 }],
          totalPaisa: 1000,
          paymentMethod: 'CASH'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(prodRes.status).toBe(400);
    const prodData = await prodRes.json();
    expect(prodData.status).toBe('rejected');
    expect(prodData.code).toBe('UNKNOWN_PRODUCT');
  });

  // -------------------------------------------------------------
  // TEST 5: ATOMIC ROLLBACK
  // -------------------------------------------------------------
  it('5. atomic rollback if one part of a sale fails: nothing is persisted', async () => {
    const validProductId = await createProduct(10, 'Atta 10kg');
    const nonExistentProductId = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();

    const syncBody = {
      operationId,
      type: 'SALE_CASH',
      payload: {
        id: saleId,
        lines: [
          { productId: validProductId, quantityBase: 2, unitPricePaisa: 100000, totalPaisa: 200000 },
          { productId: nonExistentProductId, quantityBase: 1, unitPricePaisa: 50000, totalPaisa: 50000 }
        ],
        totalPaisa: 250000,
        paymentMethod: 'CASH'
      },
      createdAt: new Date().toISOString()
    };

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncBody)
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.status).toBe('rejected');
    expect(data.code).toBe('UNKNOWN_PRODUCT');

    // Assert atomic rollback:
    expect((await pool.query('SELECT * FROM sales WHERE id = $1', [saleId])).rows.length).toBe(0);
    expect((await pool.query('SELECT * FROM stock_movements WHERE reference_id = $1', [saleId])).rows.length).toBe(0);
    expect((await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId])).rows.length).toBe(0);
    expect(await getCurrentStock(validProductId)).toBe(10);
  });

  // -------------------------------------------------------------
  // TEST 6: UDHAAR SALE INCREASES THE BALANCE
  // -------------------------------------------------------------
  it('6. an udhaar sale increases the customer balance', async () => {
    const productId = await createProduct(20, 'Sugar 1kg');
    const customerId = await createCustomer('Tariq Bhai', 0);
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        type: 'SALE_UDHAAR',
        payload: {
          id: saleId,
          customerId,
          lines: [{ productId, quantityBase: 5, unitPricePaisa: 15000, totalPaisa: 75000 }],
          totalPaisa: 75000,
          paymentMethod: 'UDHAAR'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(res.status).toBe(200);

    // Verify customer balance increased by 75000 paisa (Rs 750)
    const balance = await getCustomerBalance(customerId);
    expect(balance).toBe(75000);

    // Verify GET /api/balances confirms the increase
    const balRes = await fetch(`${baseUrl}/api/balances?customerId=${customerId}`);
    expect(balRes.status).toBe(200);
    const balData = await balRes.json();
    expect(balData.balancePaisa).toBe(75000);
    expect(balData.debitPaisa).toBe(75000);
    expect(balData.creditPaisa).toBe(0);
  });

  // -------------------------------------------------------------
  // TEST 7: PAYMENT DECREASES THE BALANCE
  // -------------------------------------------------------------
  it('7. a payment decreases the customer balance', async () => {
    const customerId = await createCustomer('Rashid Tailor', 50000); // starts with Rs 500
    const operationId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        type: 'PAYMENT_RECEIVED',
        payload: {
          id: paymentId,
          customerId,
          amountPaisa: 30000, // payment of Rs 300
          note: 'Wasooli from Rashid'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(res.status).toBe(200);

    // Balance should decrease from 50000 to 20000 paisa
    const balance = await getCustomerBalance(customerId);
    expect(balance).toBe(20000);

    // Verify GET /api/balances confirms the decrease
    const balRes = await fetch(`${baseUrl}/api/balances?customerId=${customerId}`);
    expect(balRes.status).toBe(200);
    const balData = await balRes.json();
    expect(balData.balancePaisa).toBe(20000);
    expect(balData.creditPaisa).toBe(30000);
  });

  // -------------------------------------------------------------
  // TEST 8: A RETURN ENTRY RESTORES STOCK AND CREDITS LEDGER
  // -------------------------------------------------------------
  it('8. a return entry restores stock and credits customer balance', async () => {
    const productId = await createProduct(5, 'Soap Bar');
    const customerId = await createCustomer('Zahid Master', 10000);
    const operationId = crypto.randomUUID();

    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        type: 'RETURN_ENTRY',
        payload: {
          productId,
          quantityBase: 2, // customer returns 2 bars
          customerId,
          amountPaisa: 4000, // Rs 40 credit
          reason: 'Defective packaging'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(res.status).toBe(200);

    // Stock should increase from 5 to 7
    const stock = await getCurrentStock(productId);
    expect(stock).toBe(7);

    // Customer balance should decrease from 10000 to 6000 paisa
    const balance = await getCustomerBalance(customerId);
    expect(balance).toBe(6000);
  });

  // -------------------------------------------------------------
  // TEST 9: REVERSAL OF AN UDHAAR ENTRY
  // -------------------------------------------------------------
  it('9. reversal of an udhaar entry creates opposite entry and restores balance', async () => {
    const customerId = await createCustomer('Bashir Darzi', 0);
    const entryId = crypto.randomUUID();

    // Create an initial udhaar entry directly
    await pool.query(
      `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sync_status)
       VALUES ($1, $2, 'UDHAAR', 15000, 'DEBIT', 'Mistaken charge', 'SYNCED')`,
      [entryId, customerId]
    );

    expect(await getCustomerBalance(customerId)).toBe(15000);

    // Reverse the entry
    const operationId = crypto.randomUUID();
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId,
        type: 'REVERSAL',
        payload: {
          reversalOfId: entryId,
          reason: 'Correction of accidental billing'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.duplicate).toBe(false);

    // Original entry remains in DB unchanged (append-only)
    const original = await pool.query('SELECT * FROM ledger_entries WHERE id = $1', [entryId]);
    expect(original.rows.length).toBe(1);
    expect(original.rows[0].direction).toBe('DEBIT');

    // Opposite entry created
    const reversed = await pool.query('SELECT * FROM ledger_entries WHERE reversal_of_id = $1', [entryId]);
    expect(reversed.rows.length).toBe(1);
    expect(reversed.rows[0].direction).toBe('CREDIT');
    expect(reversed.rows[0].type).toBe('REVERSAL');
    expect(reversed.rows[0].amount_paisa).toBe('15000');

    // Customer balance restored to 0
    expect(await getCustomerBalance(customerId)).toBe(0);
  });

  // -------------------------------------------------------------
  // TEST 10: REVERSAL OF A SALE RESTORES STOCK AND LEDGER
  // -------------------------------------------------------------
  it('10. reversal of a sale restores stock and ledger together in one transaction', async () => {
    const productId = await createProduct(10, 'Ghee Tin 5L');
    const customerId = await createCustomer('Chaudhry Rafiq', 0);
    const saleId = crypto.randomUUID();

    // Perform Udhaar Sale of 4 units (total 40,000 paisa)
    await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        type: 'SALE_UDHAAR',
        payload: {
          id: saleId,
          customerId,
          lines: [{ productId, quantityBase: 4, unitPricePaisa: 10000, totalPaisa: 40000 }],
          totalPaisa: 40000,
          paymentMethod: 'UDHAAR'
        },
        createdAt: new Date().toISOString()
      })
    });

    // Stock should be 6, balance should be 40000
    expect(await getCurrentStock(productId)).toBe(6);
    expect(await getCustomerBalance(customerId)).toBe(40000);

    // Reverse the entire sale
    const reversalOpId = crypto.randomUUID();
    const res = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: reversalOpId,
        type: 'REVERSAL',
        payload: {
          reversalOfId: saleId,
          reason: 'Customer returned all items and cancelled sale'
        },
        createdAt: new Date().toISOString()
      })
    });

    expect(res.status).toBe(200);

    // Stock restored back to 10
    expect(await getCurrentStock(productId)).toBe(10);

    // Balance restored back to 0
    expect(await getCustomerBalance(customerId)).toBe(0);
  });

  // -------------------------------------------------------------
  // TEST 11: REVERSING THE SAME ENTRY TWICE IS REJECTED
  // -------------------------------------------------------------
  it('11. reversing the same entry twice is rejected with ALREADY_REVERSED', async () => {
    const customerId = await createCustomer('Imran Chai Wala', 10000);
    const entryId = crypto.randomUUID();

    await pool.query(
      `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sync_status)
       VALUES ($1, $2, 'UDHAAR', 10000, 'DEBIT', 'Debit to reverse', 'SYNCED')`,
      [entryId, customerId]
    );

    // First reversal: succeeds
    const firstRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        type: 'REVERSAL',
        payload: { reversalOfId: entryId, reason: 'First reversal' },
        createdAt: new Date().toISOString()
      })
    });
    expect(firstRes.status).toBe(200);

    // Second reversal of same entry: rejected!
    const secondRes = await fetch(`${baseUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationId: crypto.randomUUID(),
        type: 'REVERSAL',
        payload: { reversalOfId: entryId, reason: 'Duplicate reversal attempt' },
        createdAt: new Date().toISOString()
      })
    });

    expect(secondRes.status).toBe(400);
    const data = await secondRes.json();
    expect(data.status).toBe('rejected');
    expect(data.code).toBe('ALREADY_REVERSED');
    expect(data.reason).toMatch(/already been reversed/i);
  });

  // -------------------------------------------------------------
  // CHECK ENDPOINTS: GET /api/stock & GET /api/balances
  // -------------------------------------------------------------
  it('computed check endpoints: GET /api/stock and GET /api/balances compute values dynamically', async () => {
    const stockRes = await fetch(`${baseUrl}/api/stock`);
    expect(stockRes.status).toBe(200);
    const stockData = await stockRes.json();
    expect(Array.isArray(stockData)).toBe(true);

    const balRes = await fetch(`${baseUrl}/api/balances`);
    expect(balRes.status).toBe(200);
    const balData = await balRes.json();
    expect(Array.isArray(balData)).toBe(true);
  });
});
