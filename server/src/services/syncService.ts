import { pool } from '../config/db';
import crypto from 'crypto';
import {
  syncRequestSchema,
  saleSchema,
  stockMovementSchema,
  ledgerEntrySchema,
  productSchema,
  customerSchema,
  reversalSchema,
  stockPurchaseSchema,
  paymentReceivedSchema
} from '../schemas/syncSchema';
import type {
  SyncResponse,
  RejectionCode,
  Product,
  Customer,
  Sale,
  StockMovement,
  LedgerEntry
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
    id: movement.id || crypto.randomUUID(),
    productId: movement.productId || movement.product_id,
    type: movement.type,
    quantityBase: movement.quantityBase ?? movement.quantity_base,
    unitCostPaisa: movement.unitCostPaisa ?? movement.unit_cost_paisa ?? null,
    referenceId: movement.referenceId ?? movement.reference_id ?? null,
    reason: movement.reason ?? null,
    createdAt: movement.createdAt || movement.created_at,
    syncStatus: movement.syncStatus || movement.sync_status || 'SYNCED'
  };
}

function normalizeLedgerEntry(entry: any): any {
  if (!entry || typeof entry !== 'object') return entry;
  return {
    id: entry.id || crypto.randomUUID(),
    customerId: entry.customerId || entry.customer_id,
    type: entry.type,
    amountPaisa: entry.amountPaisa ?? entry.amount_paisa,
    direction: entry.direction,
    note: entry.note ?? null,
    saleId: entry.saleId ?? entry.sale_id ?? null,
    reversalOfId: entry.reversalOfId ?? entry.reversal_of_id ?? null,
    reversalReason: entry.reversalReason ?? entry.reversal_reason ?? null,
    createdAt: entry.createdAt || entry.created_at,
    syncStatus: entry.syncStatus || entry.sync_status || 'SYNCED'
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
    // 1. Validate root operation shape with Zod
    const parsedRoot = syncRequestSchema.safeParse(body);
    if (!parsedRoot.success) {
      const operationId = typeof body?.operationId === 'string' ? body.operationId : '';
      const issues = parsedRoot.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return {
        statusCode: 400,
        data: {
          status: 'rejected',
          operationId,
          code: 'INVALID_DATA',
          reason: `Invalid sync request: ${issues}`
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

      const normalizedType = type.toUpperCase();

      // ==========================================
      // OPERATION 1: PRODUCT_UPSERT (or PRODUCT)
      // ==========================================
      if (
        normalizedType === 'PRODUCT_UPSERT' ||
        normalizedType === 'PRODUCT' ||
        normalizedType === 'CREATE_PRODUCT'
      ) {
        const rawProduct = payload.product || payload;
        const normalizedProduct = normalizeProduct(rawProduct);
        const parsedProduct = productSchema.safeParse(normalizedProduct);

        if (!parsedProduct.success) {
          await client.query('ROLLBACK');
          const issues = parsedProduct.error.issues.map((i) => i.message).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: `Invalid product data: ${issues}`
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
        return { statusCode: 200, data: successResponse };
      }

      // ==========================================
      // OPERATION 2: CUSTOMER_UPSERT (or CUSTOMER)
      // ==========================================
      if (
        normalizedType === 'CUSTOMER_UPSERT' ||
        normalizedType === 'CUSTOMER' ||
        normalizedType === 'CREATE_CUSTOMER'
      ) {
        const rawCustomer = payload.customer || payload;
        const normalizedCustomer = normalizeCustomer(rawCustomer);
        const parsedCustomer = customerSchema.safeParse(normalizedCustomer);

        if (!parsedCustomer.success) {
          await client.query('ROLLBACK');
          const issues = parsedCustomer.error.issues.map((i) => i.message).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: `Invalid customer data: ${issues}`
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
        return { statusCode: 200, data: successResponse };
      }

      // ==========================================
      // OPERATION 3: STOCK_PURCHASE (or PURCHASE)
      // ==========================================
      if (
        normalizedType === 'STOCK_PURCHASE' ||
        normalizedType === 'PURCHASE'
      ) {
        const rawPurchase = payload.stockMovement || payload;
        const normalizedPurchase = {
          id: rawPurchase.id || crypto.randomUUID(),
          productId: rawPurchase.productId || rawPurchase.product_id,
          quantityBase: rawPurchase.quantityBase ?? rawPurchase.quantity_base,
          unitCostPaisa: rawPurchase.unitCostPaisa ?? rawPurchase.unit_cost_paisa ?? null,
          reason: rawPurchase.reason || 'Stock Purchase',
          referenceId: rawPurchase.referenceId ?? rawPurchase.reference_id ?? null,
          createdAt: rawPurchase.createdAt || rawPurchase.created_at || createdAt
        };

        const parsedPurchase = stockPurchaseSchema.safeParse(normalizedPurchase);
        if (!parsedPurchase.success) {
          await client.query('ROLLBACK');
          const issues = parsedPurchase.error.issues.map((i) => i.message).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: `Invalid purchase data: ${issues}`
            }
          };
        }

        const purchaseData = parsedPurchase.data;

        // Verify product exists
        const prodCheck = await client.query(
          'SELECT id, name, base_unit FROM products WHERE id = $1 FOR UPDATE',
          [purchaseData.productId]
        );
        if (prodCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'UNKNOWN_PRODUCT',
              reason: `Product with id ${purchaseData.productId} not found`
            }
          };
        }

        const signedQty = Math.abs(purchaseData.quantityBase); // Purchase adds stock
        await client.query(
          `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
           VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $6, $7, 'SYNCED')`,
          [
            purchaseData.id,
            purchaseData.productId,
            signedQty,
            purchaseData.unitCostPaisa ?? null,
            purchaseData.referenceId || null,
            purchaseData.reason || 'Stock Purchase',
            purchaseData.createdAt || createdAt
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
           VALUES ($1, 'stock_movement', $2, 'STOCK_PURCHASE', $3)`,
          [operationId, purchaseData.id, JSON.stringify({ productId: purchaseData.productId, quantityBase: signedQty })]
        );

        await client.query('COMMIT');
        return { statusCode: 200, data: successResponse };
      }

      // ==========================================
      // OPERATIONS 4 & 5: SALE_CASH, SALE_UDHAAR (or SALE)
      // ==========================================
      if (
        normalizedType === 'SALE_CASH' ||
        normalizedType === 'SALE_UDHAAR' ||
        normalizedType === 'SALE' ||
        normalizedType === 'CREATE_SALE' ||
        normalizedType === 'RECORD_SALE'
      ) {
        const rawSale = payload.sale || payload;
        const normalizedSale = normalizeSale(rawSale);

        // Derive paymentMethod if not explicit
        if (!normalizedSale.paymentMethod) {
          if (normalizedType === 'SALE_UDHAAR') normalizedSale.paymentMethod = 'UDHAAR';
          else normalizedSale.paymentMethod = 'CASH';
        }

        const parsedSale = saleSchema.safeParse(normalizedSale);
        if (!parsedSale.success) {
          await client.query('ROLLBACK');
          const issues = parsedSale.error.issues.map((i) => i.message).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: `Invalid sale data: ${issues}`
            }
          };
        }

        const saleData = parsedSale.data;
        const isUdhaar =
          normalizedType === 'SALE_UDHAAR' ||
          saleData.paymentMethod.toUpperCase() === 'UDHAAR';

        // Udhaar sales strictly require a customer
        if (isUdhaar && !saleData.customerId) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: 'Udhaar sale requires customerId'
            }
          };
        }

        // Validate customer if customerId is present
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
                code: 'UNKNOWN_CUSTOMER',
                reason: `Customer with id ${saleData.customerId} not found`
              }
            };
          }
        }

        // Check product existence and lock product rows for concurrency
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
                code: 'UNKNOWN_PRODUCT',
                reason: `Product with id ${productId} not found`
              }
            };
          }
          productMap.set(productId, prodCheck.rows[0]);
        }

        // Check negative stock rule
        for (const [productId, neededQty] of requiredQuantityByProduct.entries()) {
          const stockResult = await client.query(
            'SELECT COALESCE(SUM(quantity_base), 0) AS current_stock FROM stock_movements WHERE product_id = $1',
            [productId]
          );
          const currentStock = parseInt(stockResult.rows[0].current_stock, 10);
          if (currentStock - neededQty < 0) {
            const prod = productMap.get(productId);
            const prodName = prod?.name || 'Product';
            const baseUnit = prod?.base_unit || 'units';
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                code: 'NEGATIVE_STOCK',
                reason: `${prodName} stock mein sirf ${currentStock} ${baseUnit} hai. Pehle maal aya record karein?`
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

        // Save Stock Movements
        if (Array.isArray(payload.stockMovements) && payload.stockMovements.length > 0) {
          for (const rawMove of payload.stockMovements) {
            const normMove = normalizeStockMovement(rawMove);
            const parsedMove = stockMovementSchema.safeParse(normMove);
            if (!parsedMove.success) {
              await client.query('ROLLBACK');
              return {
                statusCode: 400,
                data: {
                  status: 'rejected',
                  operationId,
                  code: 'INVALID_DATA',
                  reason: 'Invalid stock movement in sale payload'
                }
              };
            }
            const moveData = parsedMove.data;
            await client.query(
              `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SYNCED')`,
              [
                moveData.id,
                moveData.productId,
                moveData.type,
                -Math.abs(moveData.quantityBase),
                moveData.unitCostPaisa ?? null,
                moveData.referenceId || saleData.id,
                moveData.reason || 'Sale',
                moveData.createdAt || saleData.createdAt || createdAt
              ]
            );
          }
        } else {
          for (const line of saleData.lines) {
            const movementId = crypto.randomUUID();
            await client.query(
              `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
               VALUES ($1, $2, 'SALE', $3, $4, $5, $6, $7, 'SYNCED')`,
              [
                movementId,
                line.productId,
                -Math.abs(line.quantityBase),
                line.unitPricePaisa,
                saleData.id,
                'Sale',
                saleData.createdAt || createdAt
              ]
            );
          }
        }

        // Save Ledger Entry (for Udhaar sale)
        if (isUdhaar && saleData.customerId) {
          const rawLedger = payload.ledgerEntry || (Array.isArray(payload.ledgerEntries) ? payload.ledgerEntries[0] : null);
          const ledgerId = rawLedger?.id || crypto.randomUUID();
          const note = rawLedger?.note || `Udhaar sale #${saleData.id}`;
          await client.query(
            `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, created_at, sync_status)
             VALUES ($1, $2, 'UDHAAR', $3, 'DEBIT', $4, $5, $6, 'SYNCED')`,
            [
              ledgerId,
              saleData.customerId,
              saleData.totalPaisa,
              note,
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
           VALUES ($1, 'sale', $2, $3, $4)`,
          [
            operationId,
            saleData.id,
            isUdhaar ? 'SALE_UDHAAR' : 'SALE_CASH',
            JSON.stringify({ totalPaisa: saleData.totalPaisa, linesCount: saleData.lines.length })
          ]
        );

        await client.query('COMMIT');
        return { statusCode: 200, data: successResponse };
      }

      // ==========================================
      // OPERATION 6: PAYMENT_RECEIVED (or PAYMENT)
      // ==========================================
      if (
        normalizedType === 'PAYMENT_RECEIVED' ||
        normalizedType === 'PAYMENT'
      ) {
        const rawPayment = payload.ledgerEntry || payload;
        const normalizedPayment = {
          id: rawPayment.id || crypto.randomUUID(),
          customerId: rawPayment.customerId || rawPayment.customer_id,
          amountPaisa: rawPayment.amountPaisa ?? rawPayment.amount_paisa,
          note: rawPayment.note || 'Payment Received (Wasooli)',
          createdAt: rawPayment.createdAt || rawPayment.created_at || createdAt
        };

        const parsedPayment = paymentReceivedSchema.safeParse(normalizedPayment);
        if (!parsedPayment.success) {
          await client.query('ROLLBACK');
          const issues = parsedPayment.error.issues.map((i) => i.message).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: `Invalid payment data: ${issues}`
            }
          };
        }

        const paymentData = parsedPayment.data;

        // Verify customer exists
        const custCheck = await client.query(
          'SELECT id FROM customers WHERE id = $1',
          [paymentData.customerId]
        );
        if (custCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'UNKNOWN_CUSTOMER',
              reason: `Customer with id ${paymentData.customerId} not found`
            }
          };
        }

        // Payments decrease udhaar debt (CREDIT)
        await client.query(
          `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, created_at, sync_status)
           VALUES ($1, $2, 'PAYMENT', $3, 'CREDIT', $4, $5, 'SYNCED')`,
          [
            paymentData.id,
            paymentData.customerId,
            paymentData.amountPaisa,
            paymentData.note || 'Payment Received',
            paymentData.createdAt || createdAt
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
           VALUES ($1, 'ledger_entry', $2, 'PAYMENT_RECEIVED', $3)`,
          [operationId, paymentData.id, JSON.stringify({ amountPaisa: paymentData.amountPaisa })]
        );

        await client.query('COMMIT');
        return { statusCode: 200, data: successResponse };
      }

      // ==========================================
      // OPERATION 7: RETURN_ENTRY (or RETURN)
      // ==========================================
      if (
        normalizedType === 'RETURN_ENTRY' ||
        normalizedType === 'RETURN'
      ) {
        const rawReturn = payload;
        const productId = rawReturn.productId || rawReturn.product_id || rawReturn.stockMovement?.productId;
        const customerId = rawReturn.customerId || rawReturn.customer_id || rawReturn.ledgerEntry?.customerId;
        const quantityBase = rawReturn.quantityBase ?? rawReturn.quantity_base ?? rawReturn.stockMovement?.quantityBase;
        const amountPaisa = rawReturn.amountPaisa ?? rawReturn.amount_paisa ?? rawReturn.ledgerEntry?.amountPaisa;
        const reason = rawReturn.reason || 'Goods return';
        const saleId = rawReturn.saleId || rawReturn.sale_id || null;

        if (!productId && !customerId) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: 'Return entry requires productId or customerId'
            }
          };
        }

        // Validate product if goods are being returned
        if (productId) {
          const prodCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId]);
          if (prodCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                code: 'UNKNOWN_PRODUCT',
                reason: `Product with id ${productId} not found`
              }
            };
          }
          if (typeof quantityBase !== 'number' || quantityBase <= 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                code: 'INVALID_DATA',
                reason: 'Product return requires a positive quantityBase'
              }
            };
          }

          // Return restores stock (positive)
          const movementId = rawReturn.stockMovement?.id || crypto.randomUUID();
          await client.query(
            `INSERT INTO stock_movements (id, product_id, type, quantity_base, reference_id, reason, created_at, sync_status)
             VALUES ($1, $2, 'RETURN', $3, $4, $5, $6, 'SYNCED')`,
            [
              movementId,
              productId,
              Math.abs(quantityBase),
              saleId,
              reason,
              rawReturn.createdAt || createdAt
            ]
          );
        }

        // Validate customer if credit return
        if (customerId) {
          const custCheck = await client.query('SELECT id FROM customers WHERE id = $1', [customerId]);
          if (custCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                code: 'UNKNOWN_CUSTOMER',
                reason: `Customer with id ${customerId} not found`
              }
            };
          }
          if (typeof amountPaisa !== 'number' || amountPaisa <= 0) {
            await client.query('ROLLBACK');
            return {
              statusCode: 400,
              data: {
                status: 'rejected',
                operationId,
                code: 'INVALID_DATA',
                reason: 'Customer return requires a positive amountPaisa'
              }
            };
          }

          // Return decreases customer debt (CREDIT)
          const ledgerId = rawReturn.ledgerEntry?.id || crypto.randomUUID();
          await client.query(
            `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, created_at, sync_status)
             VALUES ($1, $2, 'RETURN', $3, 'CREDIT', $4, $5, $6, 'SYNCED')`,
            [
              ledgerId,
              customerId,
              amountPaisa,
              reason,
              saleId,
              rawReturn.createdAt || createdAt
            ]
          );
        }

        const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
        await client.query(
          `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
           VALUES ($1, $2, $3, $4, NOW(), $5)`,
          [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
        );

        await client.query(
          `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
           VALUES ($1, 'return', $2, 'RETURN_ENTRY', $3)`,
          [operationId, operationId, JSON.stringify({ productId, customerId, quantityBase, amountPaisa })]
        );

        await client.query('COMMIT');
        return { statusCode: 200, data: successResponse };
      }

      // ==========================================
      // OPERATION 8: REVERSAL
      // ==========================================
      if (normalizedType === 'REVERSAL') {
        const rawReversal = {
          reversalOfId: payload.reversalOfId || payload.reversal_of_id,
          reason: payload.reason
        };

        const parsedReversal = reversalSchema.safeParse(rawReversal);
        if (!parsedReversal.success) {
          await client.query('ROLLBACK');
          const issues = parsedReversal.error.issues.map((i) => i.message).join(', ');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'INVALID_DATA',
              reason: `Invalid reversal: ${issues}`
            }
          };
        }

        const { reversalOfId, reason } = parsedReversal.data;

        // Rule: An entry can be reversed only once!
        // Check if reversalOfId has already been reversed anywhere
        const alreadyReversedOp = await client.query(
          `SELECT 1 FROM processed_operations 
           WHERE type = 'REVERSAL' AND (
             payload->>'reversalOfId' = $1 OR 
             payload->>'reversal_of_id' = $1
           )`,
          [reversalOfId]
        );
        if (alreadyReversedOp.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'ALREADY_REVERSED',
              reason: 'Entry has already been reversed'
            }
          };
        }

        const ledgerReversedCheck = await client.query(
          'SELECT 1 FROM ledger_entries WHERE reversal_of_id = $1',
          [reversalOfId]
        );
        if (ledgerReversedCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'ALREADY_REVERSED',
              reason: 'Entry has already been reversed'
            }
          };
        }

        const stockReversedCheck = await client.query(
          "SELECT 1 FROM stock_movements WHERE reference_id = $1 AND type = 'REVERSAL'",
          [reversalOfId]
        );
        if (stockReversedCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'ALREADY_REVERSED',
              reason: 'Entry has already been reversed'
            }
          };
        }

        // Case A: Is reversalOfId a SALE?
        const saleResult = await client.query('SELECT * FROM sales WHERE id = $1', [reversalOfId]);
        if (saleResult.rows.length > 0) {
          const sale = saleResult.rows[0];

          // Reversing a sale reverses its ledger entry and stock movement together in ONE transaction
          // 1. Invert stock movements for this sale
          const saleMovements = await client.query(
            'SELECT * FROM stock_movements WHERE reference_id = $1',
            [sale.id]
          );

          if (saleMovements.rows.length > 0) {
            for (const move of saleMovements.rows) {
              const oppositeQty = Math.abs(parseInt(move.quantity_base, 10)); // Restores stock
              await client.query(
                `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
                 VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, 'SYNCED')`,
                [
                  crypto.randomUUID(),
                  move.product_id,
                  oppositeQty,
                  move.unit_cost_paisa,
                  sale.id,
                  reason,
                  createdAt
                ]
              );
            }
          } else if (Array.isArray(sale.lines)) {
            // Restore from sale lines
            for (const line of sale.lines) {
              await client.query(
                `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
                 VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, 'SYNCED')`,
                [
                  crypto.randomUUID(),
                  line.productId,
                  Math.abs(line.quantityBase),
                  line.unitPricePaisa,
                  sale.id,
                  reason,
                  createdAt
                ]
              );
            }
          }

          // 2. Invert ledger entries for this sale (if any)
          const saleLedgerEntries = await client.query(
            'SELECT * FROM ledger_entries WHERE sale_id = $1',
            [sale.id]
          );

          for (const entry of saleLedgerEntries.rows) {
            const oppositeDirection = entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
            await client.query(
              `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, reversal_of_id, reversal_reason, created_at, sync_status)
               VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, $8, $9, 'SYNCED')`,
              [
                crypto.randomUUID(),
                entry.customer_id,
                entry.amount_paisa,
                oppositeDirection,
                reason,
                sale.id,
                entry.id,
                reason,
                createdAt
              ]
            );
          }

          const successResponse: SyncResponse = { status: 'ok', operationId, duplicate: false };
          await client.query(
            `INSERT INTO processed_operations (operation_id, type, payload, created_at, processed_at, response)
             VALUES ($1, $2, $3, $4, NOW(), $5)`,
            [operationId, type, JSON.stringify(payload), createdAt, JSON.stringify(successResponse)]
          );

          await client.query(
            `INSERT INTO audit_log (operation_id, entity_type, entity_id, action, details)
             VALUES ($1, 'sale', $2, 'REVERSAL', $3)`,
            [operationId, sale.id, JSON.stringify({ reason })]
          );

          await client.query('COMMIT');
          return { statusCode: 200, data: successResponse };
        }

        // Case B: Is reversalOfId a LEDGER_ENTRY?
        const ledgerResult = await client.query('SELECT * FROM ledger_entries WHERE id = $1', [reversalOfId]);
        if (ledgerResult.rows.length > 0) {
          const entry = ledgerResult.rows[0];
          const oppositeDirection = entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';

          await client.query(
            `INSERT INTO ledger_entries (id, customer_id, type, amount_paisa, direction, note, sale_id, reversal_of_id, reversal_reason, created_at, sync_status)
             VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, $8, $9, 'SYNCED')`,
            [
              crypto.randomUUID(),
              entry.customer_id,
              entry.amount_paisa,
              oppositeDirection,
              reason,
              entry.sale_id || null,
              entry.id,
              reason,
              createdAt
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
             VALUES ($1, 'ledger_entry', $2, 'REVERSAL', $3)`,
            [operationId, entry.id, JSON.stringify({ reason })]
          );

          await client.query('COMMIT');
          return { statusCode: 200, data: successResponse };
        }

        // Case C: Is reversalOfId a STOCK_MOVEMENT?
        const moveResult = await client.query('SELECT * FROM stock_movements WHERE id = $1', [reversalOfId]);
        if (moveResult.rows.length > 0) {
          const movement = moveResult.rows[0];
          const oppositeQty = -parseInt(movement.quantity_base, 10);

          // If oppositeQty reduces stock, verify stock won't go negative
          if (oppositeQty < 0) {
            const stockRes = await client.query(
              'SELECT COALESCE(SUM(quantity_base), 0) AS current_stock FROM stock_movements WHERE product_id = $1',
              [movement.product_id]
            );
            const currentStock = parseInt(stockRes.rows[0].current_stock, 10);
            if (currentStock + oppositeQty < 0) {
              await client.query('ROLLBACK');
              return {
                statusCode: 400,
                data: {
                  status: 'rejected',
                  operationId,
                  code: 'NEGATIVE_STOCK',
                  reason: 'Reversal would cause negative stock'
                }
              };
            }
          }

          await client.query(
            `INSERT INTO stock_movements (id, product_id, type, quantity_base, unit_cost_paisa, reference_id, reason, created_at, sync_status)
             VALUES ($1, $2, 'REVERSAL', $3, $4, $5, $6, $7, 'SYNCED')`,
            [
              crypto.randomUUID(),
              movement.product_id,
              oppositeQty,
              movement.unit_cost_paisa,
              movement.id,
              reason,
              createdAt
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
             VALUES ($1, 'stock_movement', $2, 'REVERSAL', $3)`,
            [operationId, movement.id, JSON.stringify({ reason })]
          );

          await client.query('COMMIT');
          return { statusCode: 200, data: successResponse };
        }

        // Target not found
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          data: {
            status: 'rejected',
            operationId,
            code: 'INVALID_DATA',
            reason: `Target entry ${reversalOfId} to reverse not found`
          }
        };
      }

      // Unsupported operation type
      await client.query('ROLLBACK');
      return {
        statusCode: 400,
        data: {
          status: 'rejected',
          operationId,
          code: 'INVALID_DATA',
          reason: `Unsupported operation type: ${type}`
        }
      };
    } catch (err: any) {
      await client.query('ROLLBACK');

      if (err.code === '23503') {
        const detail = err.detail || '';
        if (detail.includes('customers')) {
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'UNKNOWN_CUSTOMER',
              reason: 'Referenced customer does not exist'
            }
          };
        }
        if (detail.includes('products')) {
          return {
            statusCode: 400,
            data: {
              status: 'rejected',
              operationId,
              code: 'UNKNOWN_PRODUCT',
              reason: 'Referenced product does not exist'
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
