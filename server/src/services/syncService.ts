import { pool } from '../config/db';
import crypto from 'crypto';
import {
  syncRequestSchema,
  saleSchema,
  stockMovementSchema,
  ledgerEntrySchema,
  productSchema,
  customerSchema
} from '../schemas/syncSchema';
import type {
  SyncResponse,
  Sale,
  StockMovement,
  LedgerEntry,
  Product,
  Customer
} from '../types';

function normalizeSaleLine(line: any): any {
  if (!line || typeof line !== 'object') return line;
  return {
    productId: line.productId || line.product_id,
    quantityBase: line.quantityBase ?? line.quantity_base,
    unitPricePaisa: line.unitPricePaisa ?? line.unit_price_paisa,
    totalPaisa: line.totalPaisa ?? line.total_paisa,
    productName: line.productName || line.product_name
  };
}

function normalizeSale(sale: any): any {
  if (!sale || typeof sale !== 'object') return sale;
  const lines = Array.isArray(sale.lines) ? sale.lines.map(normalizeSaleLine) : sale.lines;
  return {
    id: sale.id,
    customerId: sale.customerId ?? sale.customer_id ?? null,
    lines,
    totalPaisa: sale.totalPaisa ?? sale.total_paisa,
    paymentMethod: sale.paymentMethod || sale.payment_method,
    createdAt: sale.createdAt || sale.created_at
  };
}

function normalizeStockMovement(movement: any): any {
  if (!movement || typeof movement !== 'object') return movement;
  return {
    id: movement.id,
    productId: movement.productId || movement.product_id,
    type: movement.type,
    quantityBase: movement.quantityBase ?? movement.quantity_base,
    unitCostPaisa: movement.unitCostPaisa ?? movement.unit_cost_paisa ?? null,
    referenceId: movement.referenceId ?? movement.reference_id ?? null,
    reason: movement.reason ?? null,
    createdAt: movement.createdAt || movement.created_at,
    syncStatus: movement.syncStatus || movement.sync_status
  };
}

function normalizeLedgerEntry(entry: any): any {
  if (!entry || typeof entry !== 'object') return entry;
  return {
    id: entry.id,
    customerId: entry.customerId || entry.customer_id,
    type: entry.type,
    amountPaisa: entry.amountPaisa ?? entry.amount_paisa,
    direction: entry.direction,
    note: entry.note ?? null,
    saleId: entry.saleId ?? entry.sale_id ?? null,
    reversalOfId: entry.reversalOfId ?? entry.reversal_of_id ?? null,
    reversalReason: entry.reversalReason ?? entry.reversal_reason ?? null,
    createdAt: entry.createdAt || entry.created_at,
    syncStatus: entry.syncStatus || entry.sync_status
  };
}

function normalizeProduct(product: any): any {
  if (!product || typeof product !== 'object') return product;
  return {
    id: product.id,
    name: product.name,
    aliases: product.aliases ?? [],
    baseUnit: product.baseUnit || product.base_unit,
    packSize: product.packSize ?? product.pack_size ?? null,
    purchasePricePaisa: product.purchasePricePaisa ?? product.purchase_price_paisa,
    salePricePaisa: product.salePricePaisa ?? product.sale_price_paisa,
    lowStockThresholdBase: product.lowStockThresholdBase ?? product.low_stock_threshold_base ?? 0,
    createdAt: product.createdAt || product.created_at
  };
}

function normalizeCustomer(customer: any): any {
  if (!customer || typeof customer !== 'object') return customer;
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? '',
    openingBalancePaisa: customer.openingBalancePaisa ?? customer.opening_balance_paisa ?? 0,
    creditLimitPaisa: customer.creditLimitPaisa ?? customer.credit_limit_paisa ?? 0,
    createdAt: customer.createdAt || customer.created_at
  };
}

export class SyncService {
  public static async processSync(body: any): Promise<{ statusCode: number; data: SyncResponse }> {
    // 1. Validate root operation shape with zod
    const parsedRoot = syncRequestSchema.safeParse(body);
    if (!parsedRoot.success) {
      const operationId = typeof body?.operationId === 'string' ? body.operationId : '';
      const issues = parsedRoot.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return {
        statusCode: 400,
        data: {
          status: 'rejected',
          operationId,
          reason: `Invalid sync request: ${issues}`,
          code: 'invalid data'
        }
      };
    }

    const { operationId, type, payload, createdAt } = parsedRoot.data;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 2. Check Idempotency in processed_operations
      const existingOp = await client.query(
        'SELECT operation_id, response FROM processed_operations WHERE operation_id = $1',
        [operationId]
      );

      if (existingOp.rows.length > 0) {
        await client.query('COMMIT');
        return {
          statusCode: 200,
          data: {
            status: 'ok',
            operationId,
            duplicate: true
          }
        };
      }

      // Normalize operation type
      const normalizedType = type.toUpperCase();

      // 3. Handle OPERATION: SALE
      if (
        normalizedType === 'SALE' ||
        normalizedType === 'CREATE_SALE' ||
        normalizedType === 'RECORD_SALE'
      ) {
        // Extract sale data
        const rawSale = payload.sale || payload;
        const normalizedSale = normalizeSale(rawSale);
        const parsedSale = saleSchema.safeParse(normalizedSale);

        if (!parsedSale.success) {
          await client.query('ROLLBACK');
          const issues = parsedSale.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Invalid sale data: ${issues}`,
              code: 'invalid data'
            }
          };
        }

        const saleData = parsedSale.data;

        // Check customer existence if customerId is present
        if (saleData.customerId) {
          const custCheck = await client.query(
            'SELECT id FROM customers WHERE id = $1',
            [saleData.customerId]
          );
          if (custCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                reason: `Customer with id ${saleData.customerId} not found`,
                code: 'unknown customer'
              }
            };
          }
        } else if (saleData.paymentMethod.toUpperCase() === 'UDHAAR') {
          // Udhaar sale must have a customer
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: 'Udhaar sale requires customerId',
              code: 'invalid data'
            }
          };
        }

        // Check products existence and lock product rows for concurrency
        const productMap = new Map<string, { id: string; name: string; base_unit: string }>();
        const requiredQuantityByProduct = new Map<string, number>();

        for (const line of saleData.lines) {
          requiredQuantityByProduct.set(
            line.productId,
            (requiredQuantityByProduct.get(line.productId) || 0) + line.quantityBase
          );
        }

        for (const productId of requiredQuantityByProduct.keys()) {
          const prodCheck = await client.query(
            'SELECT id, name, base_unit FROM products WHERE id = $1 FOR UPDATE',
            [productId]
          );
          if (prodCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                reason: `Product with id ${productId} not found`,
                code: 'unknown product'
              }
            };
          }
          productMap.set(productId, prodCheck.rows[0]);
        }

        // SECTION 4.6 & 7: Check negative stock rule
        for (const [productId, neededQty] of requiredQuantityByProduct.entries()) {
          const stockResult = await client.query(
            'SELECT COALESCE(SUM(quantity_base), 0) AS current_stock FROM stock_movements WHERE product_id = $1',
            [productId]
          );
          const currentStock = parseInt(stockResult.rows[0].current_stock, 10);
          if (currentStock - neededQty < 0) {
            const prod = productMap.get(productId);
            const prodName = prod?.name || 'Product';
            const baseUnit = prod?.base_unit || 'kg';
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                reason: `${prodName} stock mein sirf ${currentStock} ${baseUnit} hai. Pehle maal aya record karein?`,
                code: 'stock would go negative'
              }
            };
          }
        }

        // Save Sale
        await client.query(
          `INSERT INTO sales (id, customer_id, lines, total_paisa, payment_method, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            saleData.id,
            saleData.customerId || null,
            JSON.stringify(saleData.lines),
            saleData.totalPaisa,
            saleData.paymentMethod,
            saleData.createdAt || createdAt
          ]
        );

        // Process and save Stock Movements
        if (Array.isArray(payload.stockMovements) && payload.stockMovements.length > 0) {
          for (const rawMove of payload.stockMovements) {
            const normMove = normalizeStockMovement(rawMove);
            const parsedMove = stockMovementSchema.safeParse(normMove);
            if (!parsedMove.success) {
              await client.query('ROLLBACK');
              const issues = parsedMove.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
              return {
                statusCode: 400,
                data: {
                  status: 'rejected',
                  operationId,
                  reason: `Invalid stock movement: ${issues}`,
                  code: 'invalid data'
                }
              };
            }
            const moveData = parsedMove.data;
            const signedQty = -Math.abs(moveData.quantityBase); // Sale movement reduces stock
            await client.query(
              `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                moveData.id,
                moveData.productId,
                moveData.type,
                signedQty,
                moveData.unitCostPaisa ?? null,
                moveData.referenceId || saleData.id,
                moveData.reason || 'Sale',
                moveData.createdAt || saleData.createdAt || createdAt,
                'SYNCED'
              ]
            );
          }
        } else {
          // Generate stock movements from sale lines
          for (const line of saleData.lines) {
            const movementId = crypto.randomUUID();
            await client.query(
              `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                movementId,
                line.productId,
                'SALE',
                -Math.abs(line.quantityBase),
                line.unitPricePaisa,
                saleData.id,
                'Sale',
                saleData.createdAt || createdAt,
                'SYNCED'
              ]
            );
          }
        }

        // Process and save Ledger Entry (if Udhaar / credit)
        const rawLedger = payload.ledgerEntry || (Array.isArray(payload.ledgerEntries) ? payload.ledgerEntries[0] : null);
        if (rawLedger) {
          const normLedger = normalizeLedgerEntry(rawLedger);
          const parsedLedger = ledgerEntrySchema.safeParse(normLedger);
          if (!parsedLedger.success) {
            await client.query('ROLLBACK');
            const issues = parsedLedger.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                reason: `Invalid ledger entry: ${issues}`,
                code: 'invalid data'
              }
            };
          }
          const ledgerData = parsedLedger.data;

          // Verify ledger customer exists
          const ledgerCustCheck = await client.query(
            'SELECT id FROM customers WHERE id = $1',
            [ledgerData.customerId]
          );
          if (ledgerCustCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                reason: `Customer with id ${ledgerData.customerId} not found`,
                code: 'unknown customer'
              }
            };
          }

          const direction = ledgerData.direction || (ledgerData.type === 'UDHAAR' ? 'DEBIT' : 'CREDIT');
          await client.query(
            `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, reversal_of_id, reversal_reason, created_at, sync_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              ledgerData.id,
              ledgerData.customerId,
              ledgerData.type,
              ledgerData.amountPaisa,
              direction,
              ledgerData.note || null,
              ledgerData.saleId || saleData.id,
              ledgerData.reversalOfId || null,
              ledgerData.reversalReason || null,
              ledgerData.createdAt || saleData.createdAt || createdAt,
              'SYNCED'
            ]
          );
        } else if (saleData.paymentMethod.toUpperCase() === 'UDHAAR' && saleData.customerId) {
          // Auto-generate ledger entry for Udhaar sale
          const ledgerId = crypto.randomUUID();
          await client.query(
            `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, created_at, sync_status)
             VALUES ($1, $2, 'UDHAAR', $3, 'DEBIT', $4, $5, $6, 'SYNCED')`,
            [
              ledgerId,
              saleData.customerId,
              saleData.totalPaisa,
              `Udhaar sale #${saleData.id}`,
              saleData.id,
              saleData.createdAt || createdAt
            ]
          );
        }

        // Record processed_operations and audit_log
        const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
        await client.query(
          `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
        );

        await client.query(
          `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
           VALUES ($1, 'sale', $2, 'CREATE_SALE', $3)`,
          [
            operationId,
            saleData.id,
            JSON.stringify({ totalPaisa: saleData.totalPaisa, linesCount: saleData.lines.length })
          ]
        );

        await client.query('COMMIT');
        return {
          statusCode: 200,
          data: successResponse
        };
      }

      // 4. Handle OPERATION: PRODUCT
      if (
        normalizedType === 'PRODUCT' ||
        normalizedType === 'CREATE_PRODUCT' ||
        normalizedType === 'PRODUCT_CREATE'
      ) {
        const rawProduct = payload.product || payload;
        const normalizedProduct = normalizeProduct(rawProduct);
        const parsedProduct = productSchema.safeParse(normalizedProduct);

        if (!parsedProduct.success) {
          await client.query('ROLLBACK');
          const issues = parsedProduct.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Invalid product data: ${issues}`,
              code: 'invalid data'
            }
          };
        }

        const prod = parsedProduct.data;
        await client.query(
          `INSERT INTO products (id, name, aliases, base_unit, pack_size, purchase_price_paisa, sale_price_paisa, low_stock_threshold_base, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             aliases = EXCLUDED.aliases,
             base_unit = EXCLUDED.base_unit,
             pack_size = EXCLUDED.pack_size,
             purchase_price_paisa = EXCLUDED.purchase_price_paisa,
             sale_price_paisa = EXCLUDED.sale_price_paisa,
             low_stock_threshold_base = EXCLUDED.low_stock_threshold_base`,
          [
            prod.id,
            prod.name,
            prod.aliases,
            prod.baseUnit,
            prod.packSize ?? null,
            prod.purchasePricePaisa,
            prod.salePricePaisa,
            prod.lowStockThresholdBase,
            prod.createdAt || createdAt
          ]
        );

        const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
        await client.query(
          `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
        );

        await client.query(
          `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
           VALUES ($1, 'product', $2, 'UPSERT_PRODUCT', $3)`,
          [operationId, prod.id, JSON.stringify({ name: prod.name })]
        );

        await client.query('COMMIT');
        return {
          statusCode: 200,
          data: successResponse
        };
      }

      // 5. Handle OPERATION: CUSTOMER
      if (
        normalizedType === 'CUSTOMER' ||
        normalizedType === 'CREATE_CUSTOMER' ||
        normalizedType === 'CUSTOMER_CREATE'
      ) {
        const rawCustomer = payload.customer || payload;
        const normalizedCustomer = normalizeCustomer(rawCustomer);
        const parsedCustomer = customerSchema.safeParse(normalizedCustomer);

        if (!parsedCustomer.success) {
          await client.query('ROLLBACK');
          const issues = parsedCustomer.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Invalid customer data: ${issues}`,
              code: 'invalid data'
            }
          };
        }

        const cust = parsedCustomer.data;
        await client.query(
          `INSERT INTO customers (id, name, phone, opening_balance_paisa, credit_limit_paisa, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             credit_limit_paisa = EXCLUDED.credit_limit_paisa`,
          [
            cust.id,
            cust.name,
            cust.phone,
            cust.openingBalancePaisa,
            cust.creditLimitPaisa,
            cust.createdAt || createdAt
          ]
        );

        const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
        await client.query(
          `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
        );

        await client.query(
          `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
           VALUES ($1, 'customer', $2, 'UPSERT_CUSTOMER', $3)`,
          [operationId, cust.id, JSON.stringify({ name: cust.name })]
        );

        await client.query('COMMIT');
        return {
          statusCode: 200,
          data: successResponse
        };
      }

      // 6. Handle OPERATION: STOCK_MOVEMENT / PURCHASE / DAMAGE / ADJUSTMENT
      if (
        normalizedType === 'STOCK_MOVEMENT' ||
        normalizedType === 'PURCHASE' ||
        normalizedType === 'DAMAGE' ||
        normalizedType === 'RETURN' ||
        normalizedType === 'ADJUSTMENT' ||
        normalizedType === 'REVERSAL'
      ) {
        const rawMove = payload.stockMovement || payload;
        const normalizedMove = normalizeStockMovement(rawMove);
        // Default movement type to operation type if omitted
        if (!normalizedMove.type && ['PURCHASE', 'SALE', 'DAMAGE', 'RETURN', 'ADJUSTMENT', 'REVERSAL'].includes(normalizedType)) {
          normalizedMove.type = normalizedType;
        }

        const parsedMove = stockMovementSchema.safeParse(normalizedMove);
        if (!parsedMove.success) {
          await client.query('ROLLBACK');
          const issues = parsedMove.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Invalid stock movement data: ${issues}`,
              code: 'invalid data'
            }
          };
        }

        const moveData = parsedMove.data;

        // Verify product exists
        const prodCheck = await client.query(
          'SELECT id, name, base_unit FROM products WHERE id = $1 FOR UPDATE',
          [moveData.productId]
        );
        if (prodCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Product with id ${moveData.productId} not found`,
              code: 'unknown product'
            }
          };
        }

        // Calculate signed quantityBase
        let signedQty = moveData.quantityBase;
        if (['SALE', 'DAMAGE'].includes(moveData.type)) {
          signedQty = -Math.abs(moveData.quantityBase);
        } else if (['PURCHASE', 'RETURN'].includes(moveData.type)) {
          signedQty = Math.abs(moveData.quantityBase);
        }

        // Check negative stock rule
        if (signedQty < 0) {
          const stockResult = await client.query(
            'SELECT COALESCE(SUM(quantity_base), 0) AS current_stock FROM stock_movements WHERE product_id = $1',
            [moveData.productId]
          );
          const currentStock = parseInt(stockResult.rows[0].current_stock, 10);
          if (currentStock + signedQty < 0) {
            const prod = prodCheck.rows[0];
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                reason: `${prod.name} stock mein sirf ${currentStock} ${prod.base_unit} hai. Pehle maal aya record karein?`,
                code: 'stock would go negative'
              }
            };
          }
        }

        await client.query(
          `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            moveData.id,
            moveData.productId,
            moveData.type,
            signedQty,
            moveData.unitCostPaisa ?? null,
            moveData.referenceId || null,
            moveData.reason || null,
            moveData.createdAt || createdAt,
            'SYNCED'
          ]
        );

        const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
        await client.query(
          `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
        );

        await client.query(
          `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
           VALUES ($1, 'stock_movement', $2, 'INSERT_STOCK_MOVEMENT', $3)`,
          [operationId, moveData.id, JSON.stringify({ type: moveData.type, quantityBase: signedQty })]
        );

        await client.query('COMMIT');
        return {
          statusCode: 200,
          data: successResponse
        };
      }

      // 7. Handle OPERATION: LEDGER_ENTRY / PAYMENT
      if (
        normalizedType === 'LEDGER_ENTRY' ||
        normalizedType === 'PAYMENT' ||
        normalizedType === 'UDHAAR'
      ) {
        const rawLedger = payload.ledgerEntry || payload;
        const normalizedLedger = normalizeLedgerEntry(rawLedger);
        if (!normalizedLedger.type && ['UDHAAR', 'PAYMENT', 'RETURN', 'REVERSAL'].includes(normalizedType)) {
          normalizedLedger.type = normalizedType;
        }

        const parsedLedger = ledgerEntrySchema.safeParse(normalizedLedger);
        if (!parsedLedger.success) {
          await client.query('ROLLBACK');
          const issues = parsedLedger.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Invalid ledger entry data: ${issues}`,
              code: 'invalid data'
            }
          };
        }

        const ledgerData = parsedLedger.data;

        // Verify customer exists
        const custCheck = await client.query(
          'SELECT id FROM customers WHERE id = $1',
          [ledgerData.customerId]
        );
        if (custCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: `Customer with id ${ledgerData.customerId} not found`,
              code: 'unknown customer'
            }
          };
        }

        const direction = ledgerData.direction || (ledgerData.type === 'UDHAAR' ? 'DEBIT' : 'CREDIT');
        await client.query(
          `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, reversal_of_id, reversal_reason, created_at, sync_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            ledgerData.id,
            ledgerData.customerId,
            ledgerData.type,
            ledgerData.amountPaisa,
            direction,
            ledgerData.note || null,
            ledgerData.saleId || null,
            ledgerData.reversalOfId || null,
            ledgerData.reversalReason || null,
            ledgerData.createdAt || createdAt,
            'SYNCED'
          ]
        );

        const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
        await client.query(
          `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
        );

        await client.query(
          `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
           VALUES ($1, 'ledger_entry', $2, 'INSERT_LEDGER_ENTRY', $3)`,
          [operationId, ledgerData.id, JSON.stringify({ type: ledgerData.type, amountPaisa: ledgerData.amountPaisa })]
        );

        await client.query('COMMIT');
        return {
          statusCode: 200,
          data: successResponse
        };
      }

      // Unsupported type
      await client.query('ROLLBACK');
      return {
        statusCode: 400,
        data: {
          status: 'rejected',
          operationId,
          reason: `Unsupported operation type: ${type}`,
          code: 'invalid data'
        }
      };
    } catch (err: any) {
      await client.query('ROLLBACK');

      // Check foreign key violations
      if (err.code === '23503') {
        const detail = err.detail || '';
        if (detail.includes('customers')) {
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: 'Referenced customer does not exist',
              code: 'unknown customer'
            }
          };
        }
        if (detail.includes('products')) {
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              reason: 'Referenced product does not exist',
              code: 'unknown product'
            }
          };
        }
      }

      throw err;
    } finally {
      client.release();
    }
  }
}
