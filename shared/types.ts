/**
 * Munshi Shared Types
 * Central type definitions for offline-first kiryana shop operations.
 * 
 * Rules:
 * - All monetary values are integer paisa (PKR 1.00 = 100 paisa)
 * - All quantities are integer base units (e.g. 1000 grams, 1 unit)
 * - All entity identifiers are client-generated UUIDs
 * - Ledgers and stock movements are append-only (never UPDATE or DELETE)
 */

// Supported sync operation types
export type OperationType =
  | 'PRODUCT_UPSERT'
  | 'CUSTOMER_UPSERT'
  | 'STOCK_PURCHASE'
  | 'SALE_CASH'
  | 'SALE_UDHAAR'
  | 'PAYMENT_RECEIVED'
  | 'RETURN_ENTRY'
  | 'REVERSAL';

// Error rejection codes
export type RejectionCode =
  | 'INVALID_DATA'
  | 'UNKNOWN_CUSTOMER'
  | 'UNKNOWN_PRODUCT'
  | 'NEGATIVE_STOCK'
  | 'ALREADY_REVERSED';

// Movement & ledger entry enums
export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'DAMAGE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export type LedgerEntryType = 'UDHAAR' | 'PAYMENT' | 'RETURN' | 'REVERSAL';
export type LedgerDirection = 'DEBIT' | 'CREDIT';

// Core entities
export interface Product {
  id: string; // UUID
  name: string;
  aliases: string[];
  baseUnit: string;
  packSize: number | null;
  purchasePricePaisa: number;
  salePricePaisa: number;
  lowStockThresholdBase: number;
  createdAt?: string;
}

export interface Customer {
  id: string; // UUID
  name: string;
  phone: string;
  openingBalancePaisa: number;
  creditLimitPaisa: number;
  createdAt?: string;
}

export interface SaleLine {
  productId: string; // UUID
  quantityBase: number; // positive integer
  unitPricePaisa: number; // non-negative integer
  totalPaisa: number; // non-negative integer
  productName?: string;
}

export interface Sale {
  id: string; // UUID
  customerId?: string | null; // UUID (required for SALE_UDHAAR, optional for SALE_CASH)
  lines: SaleLine[];
  totalPaisa: number;
  paymentMethod: 'CASH' | 'UDHAAR' | string;
  createdAt?: string;
}

export interface StockMovement {
  id: string; // UUID
  productId: string; // UUID
  type: StockMovementType;
  quantityBase: number; // Signed in DB: negative for SALE/DAMAGE, positive for PURCHASE/RETURN
  unitCostPaisa?: number | null;
  referenceId?: string | null;
  reason?: string | null;
  createdAt?: string;
  syncStatus?: string;
}

export interface LedgerEntry {
  id: string; // UUID
  customerId: string; // UUID
  type: LedgerEntryType;
  amountPaisa: number; // positive integer
  direction: LedgerDirection; // DEBIT increases receivable, CREDIT decreases
  note?: string | null;
  saleId?: string | null;
  reversalOfId?: string | null;
  reversalReason?: string | null;
  createdAt?: string;
  syncStatus?: string;
}

// Sync Operation Payloads
export interface ProductUpsertPayload {
  product?: Product;
  id?: string;
  name?: string;
  aliases?: string[];
  baseUnit?: string;
  packSize?: number | null;
  purchasePricePaisa?: number;
  salePricePaisa?: number;
  lowStockThresholdBase?: number;
  createdAt?: string;
}

export interface CustomerUpsertPayload {
  customer?: Customer;
  id?: string;
  name?: string;
  phone?: string;
  openingBalancePaisa?: number;
  creditLimitPaisa?: number;
  createdAt?: string;
}

export interface StockPurchasePayload {
  stockMovement?: StockMovement;
  id?: string;
  productId?: string;
  quantityBase?: number;
  unitCostPaisa?: number | null;
  reason?: string;
  referenceId?: string | null;
  createdAt?: string;
}

export interface SaleCashPayload {
  sale?: Sale;
  id?: string;
  customerId?: string | null;
  lines?: SaleLine[];
  totalPaisa?: number;
  paymentMethod?: string;
  stockMovements?: StockMovement[];
  createdAt?: string;
}

export interface SaleUdhaarPayload {
  sale?: Sale;
  id?: string;
  customerId?: string;
  lines?: SaleLine[];
  totalPaisa?: number;
  paymentMethod?: string;
  stockMovements?: StockMovement[];
  ledgerEntry?: LedgerEntry;
  createdAt?: string;
}

export interface PaymentReceivedPayload {
  ledgerEntry?: LedgerEntry;
  id?: string;
  customerId?: string;
  amountPaisa?: number;
  note?: string;
  createdAt?: string;
}

export interface ReturnEntryPayload {
  id?: string;
  productId?: string;
  quantityBase?: number;
  unitCostPaisa?: number | null;
  customerId?: string;
  amountPaisa?: number;
  saleId?: string | null;
  reason?: string;
  stockMovement?: StockMovement;
  ledgerEntry?: LedgerEntry;
  createdAt?: string;
}

export interface ReversalPayload {
  reversalOfId: string; // UUID of the original sale, ledger entry, or stock movement
  reason: string; // Mandatory explanation
  id?: string; // Optional UUID for new opposite entry
  createdAt?: string;
}

// Sync Request & Responses
export interface SyncRequest<T = any> {
  operationId: string; // UUID
  type: OperationType | string;
  payload: T;
  createdAt: string; // ISO-8601 string
}

export interface SyncSuccessResponse {
  status: 'ok';
  operationId: string;
  duplicate: boolean;
}

export interface SyncRejectionResponse {
  status: 'rejected';
  operationId: string;
  code: RejectionCode;
  reason: string;
}

export type SyncResponse = SyncSuccessResponse | SyncRejectionResponse;

// Computed Balances & Stock Responses
export interface CustomerBalance {
  customerId: string;
  customerName: string;
  phone: string;
  openingBalancePaisa: number;
  debitPaisa: number;
  creditPaisa: number;
  balancePaisa: number; // Derived: openingBalancePaisa + debitPaisa - creditPaisa
}

export interface ProductStock {
  productId: string;
  productName: string;
  baseUnit: string;
  currentStock: number; // Derived: SUM(quantity_base) from stock_movements
  lowStockThresholdBase: number;
  isLowStock: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected' | 'unhealthy';
  timestamp?: string;
  error?: string;
}
