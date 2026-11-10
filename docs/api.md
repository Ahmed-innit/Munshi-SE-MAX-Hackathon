# Munshi Backend API Documentation

Munshi is an offline-first PWA for Kiryana shop owners in Pakistan. The backend server provides synchronization, authoritative validation, deduplication, and derived query endpoints.

---

## Core Rules & Architecture

1. **Monetary Units**: All amounts are represented as **positive integer paisa** (`100 paisa = 1 PKR`). No floating-point money values are permitted.
2. **Quantities**: All stock quantities are represented as **integer base units** (e.g. `1000` base units for 1 kg or 1 packet).
3. **Identifiers**: All entity IDs and `operationId` values are client-generated **UUIDs** (RFC 4122 v4) allowing offline creation and safe idempotency replays.
4. **Append-Only Ledger & Stock Movements**: Stock movements and ledger entries are strictly append-only. Rows are never updated or deleted; corrections and cancellations are processed through compensating reversals.
5. **Reversals**: Reversing an entry requires `reversalOfId` and a mandatory `reason`. An entry can be reversed only once. Reversing a sale reverses its ledger entry and stock movement together in one atomic database transaction.
6. **Server Authority**: Client devices capture transactions locally in IndexedDB. During sync, the server performs authoritative validation, negative-stock verification, and single-transaction persistence.

---

## Standard Response Envelopes

### Success Response
```json
{
  "status": "ok",
  "operationId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "duplicate": false
}
```
*Note: Replaying the same `operationId` returns `duplicate: true` with status 200 and inserts no new records.*

### Rejection Response
When an operation cannot be applied due to domain rules or validation errors, the server rejects it with HTTP 400:
```json
{
  "status": "rejected",
  "operationId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "code": "NEGATIVE_STOCK",
  "reason": "Chawal stock mein sirf 1 kg hai. Pehle maal aya record karein?"
}
```

#### Rejection Codes
- `INVALID_DATA`: Payload failed schema validation, missing mandatory fields, negative money, or non-UUID ids.
- `UNKNOWN_CUSTOMER`: Referenced `customerId` does not exist in the database.
- `UNKNOWN_PRODUCT`: Referenced `productId` does not exist in the database.
- `NEGATIVE_STOCK`: Operation would drive available product stock below zero base units.
- `ALREADY_REVERSED`: Target entry referenced by `reversalOfId` has already been reversed.

---

## Endpoints

### 1. `GET /api/health`
Health check verifying server and database connectivity.

**Request:**
`GET /api/health`

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-11-10T12:00:00.000Z"
}
```

---

### 2. `GET /api/balances`
Computes customer balances dynamically from immutable ledger entries.

**Query Parameters (Optional):**
- `customerId` (UUID): Returns the computed balance for a single customer.

**Request:**
`GET /api/balances`

**Success Response (HTTP 200):**
```json
[
  {
    "customerId": "8f8b0e7d-9dc4-4d8b-944a-9e1201988db2",
    "customerName": "Chaudhry Bashir",
    "phone": "0300-8541290",
    "openingBalancePaisa": 0,
    "debitPaisa": 150000,
    "creditPaisa": 50000,
    "balancePaisa": 100000
  }
]
```

---

### 3. `GET /api/stock`
Computes current inventory stock dynamically from immutable stock movements.

**Query Parameters (Optional):**
- `productId` (UUID): Returns the computed stock for a single product.

**Request:**
`GET /api/stock`

**Success Response (HTTP 200):**
```json
[
  {
    "productId": "4a1b0c9e-2d3f-4e5a-6b7c-8d9e0f1a2b3c",
    "productName": "Guard Basmati Rice (10kg)",
    "baseUnit": "Bag",
    "currentStock": 24,
    "lowStockThresholdBase": 8,
    "isLowStock": false
  }
]
```

---

### 4. `POST /api/sync`
Accepts one business transaction per request.

---

#### Operation Type: `PRODUCT_UPSERT`
Upserts a product catalog record.

**Example Request:**
```json
{
  "operationId": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
  "type": "PRODUCT_UPSERT",
  "payload": {
    "id": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
    "name": "Mezan Banaspati Ghee (5L)",
    "aliases": ["Mezan Ghee", "Ghee 5L"],
    "baseUnit": "Tin",
    "packSize": 1,
    "purchasePricePaisa": 252000,
    "salePricePaisa": 268000,
    "lowStockThresholdBase": 5
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
  "duplicate": false
}
```

**Rejection Response (`INVALID_DATA`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d",
  "code": "INVALID_DATA",
  "reason": "Invalid product data: baseUnit is required, purchasePricePaisa must be non-negative"
}
```

---

#### Operation Type: `CUSTOMER_UPSERT`
Upserts a customer account.

**Example Request:**
```json
{
  "operationId": "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e",
  "type": "CUSTOMER_UPSERT",
  "payload": {
    "id": "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
    "name": "Bhai Tariq",
    "phone": "0301-8847291",
    "openingBalancePaisa": 0,
    "creditLimitPaisa": 1500000
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e",
  "duplicate": false
}
```

**Rejection Response (`INVALID_DATA`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e",
  "code": "INVALID_DATA",
  "reason": "Invalid customer data: customer name is required"
}
```

---

#### Operation Type: `STOCK_PURCHASE`
Records inventory received from a supplier.

**Example Request:**
```json
{
  "operationId": "c3d4e5f6-a1b2-4c3d-8e4f-5a6b7c8d9e0f",
  "type": "STOCK_PURCHASE",
  "payload": {
    "id": "e3f4a5b6-c7d8-4e9f-0a1b-2c3d4e5f6a7b",
    "productId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
    "quantityBase": 20,
    "unitCostPaisa": 252000,
    "reason": "Supplier delivery invoice #9842"
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "c3d4e5f6-a1b2-4c3d-8e4f-5a6b7c8d9e0f",
  "duplicate": false
}
```

**Rejection Response (`UNKNOWN_PRODUCT`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "c3d4e5f6-a1b2-4c3d-8e4f-5a6b7c8d9e0f",
  "code": "UNKNOWN_PRODUCT",
  "reason": "Product with id c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f not found"
}
```

**Rejection Response (`INVALID_DATA`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "c3d4e5f6-a1b2-4c3d-8e4f-5a6b7c8d9e0f",
  "code": "INVALID_DATA",
  "reason": "Invalid purchase data: quantityBase must be a positive integer"
}
```

---

#### Operation Type: `SALE_CASH`
Records a walk-in or customer cash sale.

**Example Request:**
```json
{
  "operationId": "d4e5f6a1-b2c3-4d4e-8f5a-6b7c8d9e0f1a",
  "type": "SALE_CASH",
  "payload": {
    "id": "f4a5b6c7-d8e9-4f0a-1b2c-3d4e5f6a7b8c",
    "lines": [
      {
        "productId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
        "quantityBase": 2,
        "unitPricePaisa": 268000,
        "totalPaisa": 536000
      }
    ],
    "totalPaisa": 536000,
    "paymentMethod": "CASH"
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "d4e5f6a1-b2c3-4d4e-8f5a-6b7c8d9e0f1a",
  "duplicate": false
}
```

**Rejection Response (`NEGATIVE_STOCK`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "d4e5f6a1-b2c3-4d4e-8f5a-6b7c8d9e0f1a",
  "code": "NEGATIVE_STOCK",
  "reason": "Mezan Banaspati Ghee (5L) stock mein sirf 1 Tin hai. Pehle maal aya record karein?"
}
```

**Rejection Response (`UNKNOWN_PRODUCT`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "d4e5f6a1-b2c3-4d4e-8f5a-6b7c8d9e0f1a",
  "code": "UNKNOWN_PRODUCT",
  "reason": "Product with id c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f not found"
}
```

---

#### Operation Type: `SALE_UDHAAR`
Records a credit sale with customer receivable. Saves the sale, its signed stock movements, and its ledger entry in ONE atomic database transaction.

**Example Request:**
```json
{
  "operationId": "e5f6a1b2-c3d4-4e5f-9a1b-2c3d4e5f6a7b",
  "type": "SALE_UDHAAR",
  "payload": {
    "id": "a5b6c7d8-e9f0-4a1b-2c3d-4e5f6a7b8c9d",
    "customerId": "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
    "lines": [
      {
        "productId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
        "quantityBase": 1,
        "unitPricePaisa": 268000,
        "totalPaisa": 268000
      }
    ],
    "totalPaisa": 268000,
    "paymentMethod": "UDHAAR"
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "e5f6a1b2-c3d4-4e5f-9a1b-2c3d4e5f6a7b",
  "duplicate": false
}
```

**Rejection Response (`UNKNOWN_CUSTOMER`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "e5f6a1b2-c3d4-4e5f-9a1b-2c3d4e5f6a7b",
  "code": "UNKNOWN_CUSTOMER",
  "reason": "Customer with id d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a not found"
}
```

**Rejection Response (`NEGATIVE_STOCK`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "e5f6a1b2-c3d4-4e5f-9a1b-2c3d4e5f6a7b",
  "code": "NEGATIVE_STOCK",
  "reason": "Mezan Banaspati Ghee (5L) stock mein sirf 0 Tin hai. Pehle maal aya record karein?"
}
```

**Rejection Response (`INVALID_DATA`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "e5f6a1b2-c3d4-4e5f-9a1b-2c3d4e5f6a7b",
  "code": "INVALID_DATA",
  "reason": "Udhaar sale requires customerId"
}
```

---

#### Operation Type: `PAYMENT_RECEIVED`
Records an udhaar recovery payment (wasooli) from a customer.

**Example Request:**
```json
{
  "operationId": "f6a1b2c3-d4e5-4f6a-9b1c-3d4e5f6a7b8c",
  "type": "PAYMENT_RECEIVED",
  "payload": {
    "id": "b6c7d8e9-f0a1-4b2c-3d4e-5f6a7b8c9d0e",
    "customerId": "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
    "amountPaisa": 100000,
    "note": "Cash wasooli at shop counter"
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "f6a1b2c3-d4e5-4f6a-9b1c-3d4e5f6a7b8c",
  "duplicate": false
}
```

**Rejection Response (`UNKNOWN_CUSTOMER`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "f6a1b2c3-d4e5-4f6a-9b1c-3d4e5f6a7b8c",
  "code": "UNKNOWN_CUSTOMER",
  "reason": "Customer with id d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a not found"
}
```

**Rejection Response (`INVALID_DATA`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "f6a1b2c3-d4e5-4f6a-9b1c-3d4e5f6a7b8c",
  "code": "INVALID_DATA",
  "reason": "Invalid payment data: amountPaisa must be a positive integer"
}
```

---

#### Operation Type: `RETURN_ENTRY`
Records goods returned by a customer or damaged stock adjustments.

**Example Request:**
```json
{
  "operationId": "0a1b2c3d-4e5f-4a1b-9c2d-3e4f5a6b7c8d",
  "type": "RETURN_ENTRY",
  "payload": {
    "productId": "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f",
    "quantityBase": 1,
    "customerId": "d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a",
    "amountPaisa": 268000,
    "reason": "Customer returned unopened tin"
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "0a1b2c3d-4e5f-4a1b-9c2d-3e4f5a6b7c8d",
  "duplicate": false
}
```

**Rejection Response (`UNKNOWN_CUSTOMER`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "0a1b2c3d-4e5f-4a1b-9c2d-3e4f5a6b7c8d",
  "code": "UNKNOWN_CUSTOMER",
  "reason": "Customer with id d2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f6a not found"
}
```

**Rejection Response (`UNKNOWN_PRODUCT`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "0a1b2c3d-4e5f-4a1b-9c2d-3e4f5a6b7c8d",
  "code": "UNKNOWN_PRODUCT",
  "reason": "Product with id c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f not found"
}
```

---

#### Operation Type: `REVERSAL`
Reverses a previous business transaction (sale, ledger entry, or stock movement). Creates a new opposite entry and leaves original records intact. An entry can be reversed only once.

**Example Request (Reversing a Sale):**
```json
{
  "operationId": "1b2c3d4e-5f6a-4b2c-9d3e-4f5a6b7c8d9e",
  "type": "REVERSAL",
  "payload": {
    "reversalOfId": "a5b6c7d8-e9f0-4a1b-2c3d-4e5f6a7b8c9d",
    "reason": "Wrong billing customer requested cancellation"
  },
  "createdAt": "2026-11-10T12:00:00.000Z"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "ok",
  "operationId": "1b2c3d4e-5f6a-4b2c-9d3e-4f5a6b7c8d9e",
  "duplicate": false
}
```

**Rejection Response (`ALREADY_REVERSED`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "1b2c3d4e-5f6a-4b2c-9d3e-4f5a6b7c8d9e",
  "code": "ALREADY_REVERSED",
  "reason": "Entry has already been reversed"
}
```

**Rejection Response (`INVALID_DATA`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "1b2c3d4e-5f6a-4b2c-9d3e-4f5a6b7c8d9e",
  "code": "INVALID_DATA",
  "reason": "Invalid reversal: reversal reason is mandatory"
}
```

**Rejection Response (`NEGATIVE_STOCK`, HTTP 400):**
```json
{
  "status": "rejected",
  "operationId": "1b2c3d4e-5f6a-4b2c-9d3e-4f5a6b7c8d9e",
  "code": "NEGATIVE_STOCK",
  "reason": "Reversal would cause negative stock"
}
```
