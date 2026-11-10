import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import app from '../src/app';
import { pool } from '../src/config/db';
import crypto from 'crypto';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  // Start server on an ephemeral port
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
  await pool.end();
});

describe('Munshi Kiryana Sync & Health API', { timeout: 30000 }, () => {
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
  async function createCustomer(name = 'Test Customer') {
    const customerId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO customers (id, name, phone, opening_balance_paisa, credit_limit_paisa)
       VALUES ($1, $2, $3, $4, $5)`,
      [customerId, name, '03001234567', 0, 500000]
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

  describe('GET /api/health', () => {
    it('should return 200 with database connected status', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.database).toBe('connected');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('POST /api/sync', () => {
    // 1. FIRST SYNC
    it('1. first sync: should successfully process and persist a sale, stock movement, and ledger entry in one transaction', async () => {
      const productId = await createProduct(10, 'Basmati Rice 1kg');
      const customerId = await createCustomer('Haji Rafiq');
      const operationId = crypto.randomUUID();
      const saleId = crypto.randomUUID();
      const movementId = crypto.randomUUID();
      const ledgerEntryId = crypto.randomUUID();

      const payload = {
        sale: {
          id: saleId,
          customerId,
          lines: [
            {
              productId,
              quantityBase: 3,
              unitPricePaisa: 12000,
              totalPaisa: 36000
            }
          ],
          totalPaisa: 36000,
          paymentMethod: 'UDHAAR'
        },
        stockMovements: [
          {
            id: movementId,
            productId,
            type: 'SALE',
            quantityBase: 3,
            unitCostPaisa: 12000,
            referenceId: saleId,
            reason: 'Counter sale'
          }
        ],
        ledgerEntry: {
          id: ledgerEntryId,
          customerId,
          type: 'UDHAAR',
          amountPaisa: 36000,
          direction: 'DEBIT',
          note: 'Udhaar sale'
        }
      };

      const res = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId,
          type: 'SALE',
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

      // Verify Sale in database
      const saleRow = await pool.query('SELECT * FROM sales WHERE id = $1', [saleId]);
      expect(saleRow.rows.length).toBe(1);
      expect(saleRow.rows[0].customer_id).toBe(customerId);
      expect(saleRow.rows[0].total_paisa).toBe('36000');
      expect(saleRow.rows[0].payment_method).toBe('UDHAAR');

      // Verify Stock Movement in database (signed by type: SALE is negative)
      const moveRow = await pool.query('SELECT * FROM stock_movements WHERE id = $1', [movementId]);
      expect(moveRow.rows.length).toBe(1);
      expect(moveRow.rows[0].product_id).toBe(productId);
      expect(moveRow.rows[0].quantity_base).toBe(-3);
      expect(moveRow.rows[0].sync_status).toBe('SYNCED');

      // Verify Stock reduced from 10 to 7
      const newStock = await getCurrentStock(productId);
      expect(newStock).toBe(7);

      // Verify Ledger Entry in database
      const ledgerRow = await pool.query('SELECT * FROM ledger_entries WHERE id = $1', [ledgerEntryId]);
      expect(ledgerRow.rows.length).toBe(1);
      expect(ledgerRow.rows[0].customer_id).toBe(customerId);
      expect(ledgerRow.rows[0].amount_paisa).toBe('36000');
      expect(ledgerRow.rows[0].direction).toBe('DEBIT');
      expect(ledgerRow.rows[0].sync_status).toBe('SYNCED');

      // Verify processed_operations
      const procRow = await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId]);
      expect(procRow.rows.length).toBe(1);
      expect(procRow.rows[0].type).toBe('SALE');

      // Verify audit_log
      const auditRow = await pool.query('SELECT * FROM audit_log WHERE operation_id = $1', [operationId]);
      expect(auditRow.rows.length).toBeGreaterThan(0);
    });

    // 2. REPLAY OF THE SAME OPERATION ID (IDEMPOTENCY)
    it('2. replay of the same operationId: should return duplicate: true and insert nothing new', async () => {
      const productId = await createProduct(10, 'Cooking Oil 1L');
      const operationId = crypto.randomUUID();
      const saleId = crypto.randomUUID();

      const syncBody = {
        operationId,
        type: 'SALE',
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

      // First sync
      const firstRes = await fetch(`${baseUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncBody)
      });
      expect(firstRes.status).toBe(200);
      const firstData = await firstRes.json();
      expect(firstData.duplicate).toBe(false);

      // Snapshot row counts
      const salesCountBefore = (await pool.query('SELECT COUNT(*) FROM sales WHERE id = $1', [saleId])).rows[0].count;
      const movementsCountBefore = (await pool.query('SELECT COUNT(*) FROM stock_movements WHERE reference_id = $1', [saleId])).rows[0].count;
      const stockBefore = await getCurrentStock(productId);

      // Replay identical operationId
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

      // Verify nothing new was created
      const salesCountAfter = (await pool.query('SELECT COUNT(*) FROM sales WHERE id = $1', [saleId])).rows[0].count;
      const movementsCountAfter = (await pool.query('SELECT COUNT(*) FROM stock_movements WHERE reference_id = $1', [saleId])).rows[0].count;
      const stockAfter = await getCurrentStock(productId);

      expect(salesCountAfter).toBe(salesCountBefore);
      expect(movementsCountAfter).toBe(movementsCountBefore);
      expect(stockAfter).toBe(stockBefore);
    });

    // 3. NEGATIVE STOCK REJECTION
    it('3. negative stock rejection: should reject when a sale would take stock below zero', async () => {
      // Product has 1 kg in stock
      const productId = await createProduct(1, 'Chawal');
      const operationId = crypto.randomUUID();
      const saleId = crypto.randomUUID();

      // Client attempts to sell 2 kg
      const syncBody = {
        operationId,
        type: 'SALE',
        payload: {
          id: saleId,
          lines: [
            {
              productId,
              quantityBase: 2, // Stock is only 1!
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
      expect(data.code).toBe('stock would go negative');
      expect(data.reason).toMatch(/stock mein sirf 1 kg hai/i);

      // Verify nothing was persisted
      const saleCheck = await pool.query('SELECT * FROM sales WHERE id = $1', [saleId]);
      expect(saleCheck.rows.length).toBe(0);

      const opCheck = await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId]);
      expect(opCheck.rows.length).toBe(0);

      // Stock remains untouched at 1 kg
      const stock = await getCurrentStock(productId);
      expect(stock).toBe(1);
    });

    // 4. UNKNOWN CUSTOMER REJECTION
    it('4. unknown customer rejection: should reject when referencing a non-existent customer', async () => {
      const productId = await createProduct(10, 'Sugar 1kg');
      const nonExistentCustomerId = crypto.randomUUID();
      const operationId = crypto.randomUUID();
      const saleId = crypto.randomUUID();

      const syncBody = {
        operationId,
        type: 'SALE',
        payload: {
          id: saleId,
          customerId: nonExistentCustomerId,
          lines: [
            {
              productId,
              quantityBase: 1,
              unitPricePaisa: 15000,
              totalPaisa: 15000
            }
          ],
          totalPaisa: 15000,
          paymentMethod: 'UDHAAR'
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
      expect(data.code).toBe('unknown customer');
      expect(data.reason).toMatch(new RegExp(nonExistentCustomerId, 'i'));

      // Verify no records created
      const saleCheck = await pool.query('SELECT * FROM sales WHERE id = $1', [saleId]);
      expect(saleCheck.rows.length).toBe(0);

      const opCheck = await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId]);
      expect(opCheck.rows.length).toBe(0);

      // Stock remains untouched at 10
      const stock = await getCurrentStock(productId);
      expect(stock).toBe(10);
    });

    // 5. ATOMIC ROLLBACK
    it('5. atomic rollback: if any part fails, nothing should be saved to the database', async () => {
      // Product 1 has sufficient stock (10), Product 2 does NOT exist (unknown product)
      const validProductId = await createProduct(10, 'Atta 10kg');
      const invalidProductId = crypto.randomUUID(); // Does not exist
      const operationId = crypto.randomUUID();
      const saleId = crypto.randomUUID();

      const syncBody = {
        operationId,
        type: 'SALE',
        payload: {
          id: saleId,
          lines: [
            {
              productId: validProductId,
              quantityBase: 2,
              unitPricePaisa: 120000,
              totalPaisa: 240000
            },
            {
              productId: invalidProductId, // Causes failure!
              quantityBase: 1,
              unitPricePaisa: 50000,
              totalPaisa: 50000
            }
          ],
          totalPaisa: 290000,
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
      expect(data.code).toBe('unknown product');

      // Verify ATOMIC ROLLBACK:
      // 1. Sale was NOT saved
      const saleCheck = await pool.query('SELECT * FROM sales WHERE id = $1', [saleId]);
      expect(saleCheck.rows.length).toBe(0);

      // 2. No stock movements were saved for either product
      const moveCheck = await pool.query('SELECT * FROM stock_movements WHERE reference_id = $1', [saleId]);
      expect(moveCheck.rows.length).toBe(0);

      // 3. Valid product stock was NOT deducted
      const stock = await getCurrentStock(validProductId);
      expect(stock).toBe(10);

      // 4. processed_operations has no entry
      const opCheck = await pool.query('SELECT * FROM processed_operations WHERE operation_id = $1', [operationId]);
      expect(opCheck.rows.length).toBe(0);
    });

    // Additional test: Unknown Product rejection
    it('should reject with code "unknown product" if single product is not found', async () => {
      const nonExistentProductId = crypto.randomUUID();
      const operationId = crypto.randomUUID();

      const syncBody = {
        operationId,
        type: 'SALE',
        payload: {
          id: crypto.randomUUID(),
          lines: [
            {
              productId: nonExistentProductId,
              quantityBase: 1,
              unitPricePaisa: 1000,
              totalPaisa: 1000
            }
          ],
          totalPaisa: 1000,
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
      expect(data.code).toBe('unknown product');
    });

    // Additional test: Invalid Data rejection
    it('should reject with code "invalid data" when payload fails zod validation', async () => {
      const operationId = crypto.randomUUID();

      // Missing required lines array and negative totalPaisa
      const syncBody = {
        operationId,
        type: 'SALE',
        payload: {
          id: 'not-a-valid-uuid',
          totalPaisa: -500,
          paymentMethod: ''
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
      expect(data.code).toBe('invalid data');
      expect(data.reason).toBeDefined();
    });

    // Additional test: Append-Only Trigger Verification
    it('should prevent UPDATE and DELETE on stock_movements and ledger_entries via database triggers', async () => {
      const productId = await createProduct(5, 'Spices Pack');
      const customerId = await createCustomer('Zahid Kiryana');

      // Insert a stock movement
      const moveId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reason, sync_status)
         VALUES ($1, $2, 'PURCHASE', 5, 2000, 'Purchase', 'SYNCED')`,
        [moveId, productId]
      );

      // Attempt UPDATE on stock_movements should fail
      await expect(
        pool.query('UPDATE stock_movements SET quantity_base = 100 WHERE id = $1', [moveId])
      ).rejects.toThrow(/append-only/i);

      // Attempt DELETE on stock_movements should fail
      await expect(
        pool.query('DELETE FROM stock_movements WHERE id = $1', [moveId])
      ).rejects.toThrow(/append-only/i);

      // Insert a ledger entry
      const ledgerId = crypto.randomUUID();
      await pool.query(
        `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sync_status)
         VALUES ($1, $2, 'PAYMENT', 10000, 'CREDIT', 'Cash received', 'SYNCED')`,
        [ledgerId, customerId]
      );

      // Attempt UPDATE on ledger_entries should fail
      await expect(
        pool.query('UPDATE ledger_entries SET amount_paisa = 50000 WHERE id = $1', [ledgerId])
      ).rejects.toThrow(/append-only/i);

      // Attempt DELETE on ledger_entries should fail
      await expect(
        pool.query('DELETE FROM ledger_entries WHERE id = $1', [ledgerId])
      ).rejects.toThrow(/append-only/i);
    });
  });
});
