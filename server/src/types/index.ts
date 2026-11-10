export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'DAMAGE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'REVERSAL';

export type LedgerEntryType = 'UDHAAR' | 'PAYMENT' | 'RETURN' | 'REVERSAL';
export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface Product {
  id: string;
  name: string;
  aliases: string[];
  baseUnit: string;
  packSize: number | null;
  purchasePricePaisa: number;
  salePricePaisa: number;
  lowStockThresholdBase: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  openingBalancePaisa: number;
  creditLimitPaisa: number;
  createdAt: string;
}

export interface SaleLine {
  productId: string;
  quantityBase: number;
  unitPricePaisa: number;
  totalPaisa: number;
  productName?: string;
}

export interface Sale {
  id: string;
  customerId?: string | null;
  lines: SaleLine[];
  totalPaisa: number;
  paymentMethod: string;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityBase: number;
  unitCostPaisa?: number | null;
  referenceId?: string | null;
  reason?: string | null;
  createdAt?: string;
  syncStatus?: string;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  type: LedgerEntryType;
  amountPaisa: number;
  direction: LedgerDirection;
  note?: string | null;
  saleId?: string | null;
  reversalOfId?: string | null;
  reversalReason?: string | null;
  createdAt?: string;
  syncStatus?: string;
}

export interface ProcessedOperation {
  operationId: string;
  type: string;
  payload: any;
  createdAt: string;
  processedAt?: string;
  response?: any;
}

export interface AuditLog {
  id?: string;
  operationId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details?: any;
  createdAt?: string;
}

export type SyncSuccessResponse = {
  status: 'ok';
  operationId: string;
  duplicate: boolean;
};

export type SyncRejectionCode =
  | 'unknown customer'
  | 'unknown product'
  | 'invalid data'
  | 'stock would go negative';

export type SyncRejectionResponse = {
  status: 'rejected';
  operationId: string;
  reason: string;
  code: SyncRejectionCode;
};

export type SyncResponse = SyncSuccessResponse | SyncRejectionResponse;
