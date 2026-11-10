import { z } from 'zod';

export const syncRequestSchema = z.object({
  operationId: z.string().uuid({ message: 'operationId must be a valid UUID' }),
  type: z.string().min(1, { message: 'type is required' }),
  payload: z.record(z.string(), z.any()).or(z.object({}).passthrough()),
  createdAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'createdAt must be a valid date'
  })
});

export const saleLineSchema = z.object({
  productId: z.string().uuid({ message: 'productId must be a valid UUID' }),
  quantityBase: z.number().int({ message: 'quantityBase must be an integer' }).positive({ message: 'quantityBase must be positive' }),
  unitPricePaisa: z.number().int({ message: 'unitPricePaisa must be an integer' }).nonnegative({ message: 'unitPricePaisa must be non-negative' }),
  totalPaisa: z.number().int({ message: 'totalPaisa must be an integer' }).nonnegative({ message: 'totalPaisa must be non-negative' }),
  productName: z.string().optional()
});

export const saleSchema = z.object({
  id: z.string().uuid({ message: 'sale id must be a valid UUID' }),
  customerId: z.string().uuid({ message: 'customerId must be a valid UUID' }).nullable().optional(),
  lines: z.array(saleLineSchema).min(1, { message: 'Sale must have at least one line' }),
  totalPaisa: z.number().int().nonnegative({ message: 'totalPaisa must be non-negative' }),
  paymentMethod: z.string().min(1, { message: 'paymentMethod is required' }),
  createdAt: z.string().optional()
});

export const stockMovementSchema = z.object({
  id: z.string().uuid({ message: 'stock movement id must be a valid UUID' }),
  productId: z.string().uuid({ message: 'productId must be a valid UUID' }),
  type: z.enum(['PURCHASE', 'SALE', 'DAMAGE', 'RETURN', 'ADJUSTMENT', 'REVERSAL']),
  quantityBase: z.number().int({ message: 'quantityBase must be an integer' }),
  unitCostPaisa: z.number().int().nonnegative().nullable().optional(),
  referenceId: z.string().uuid().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  syncStatus: z.string().optional()
});

export const ledgerEntrySchema = z.object({
  id: z.string().uuid({ message: 'ledger entry id must be a valid UUID' }),
  customerId: z.string().uuid({ message: 'customerId must be a valid UUID' }),
  type: z.enum(['UDHAAR', 'PAYMENT', 'RETURN', 'REVERSAL']),
  amountPaisa: z.number().int().nonnegative({ message: 'amountPaisa must be non-negative integer' }),
  direction: z.enum(['DEBIT', 'CREDIT']).optional(),
  note: z.string().nullable().optional(),
  saleId: z.string().uuid().nullable().optional(),
  reversalOfId: z.string().uuid().nullable().optional(),
  reversalReason: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  syncStatus: z.string().optional()
});

export const productSchema = z.object({
  id: z.string().uuid({ message: 'product id must be a valid UUID' }),
  name: z.string().min(1, { message: 'product name is required' }),
  aliases: z.array(z.string()).default([]),
  baseUnit: z.string().min(1, { message: 'baseUnit is required' }),
  packSize: z.number().int().positive().nullable().optional(),
  purchasePricePaisa: z.number().int().nonnegative({ message: 'purchasePricePaisa must be non-negative' }),
  salePricePaisa: z.number().int().nonnegative({ message: 'salePricePaisa must be non-negative' }),
  lowStockThresholdBase: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional()
});

export const customerSchema = z.object({
  id: z.string().uuid({ message: 'customer id must be a valid UUID' }),
  name: z.string().min(1, { message: 'customer name is required' }),
  phone: z.string().default(''),
  openingBalancePaisa: z.number().int().default(0),
  creditLimitPaisa: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional()
});
