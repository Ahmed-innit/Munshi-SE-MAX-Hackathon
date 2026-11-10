-- Munshi Database Schema
-- Migration: 001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT[] NOT NULL DEFAULT '{}',
    base_unit TEXT NOT NULL,
    pack_size INTEGER NULL,
    purchase_price_paisa BIGINT NOT NULL CHECK (purchase_price_paisa >= 0),
    sale_price_paisa BIGINT NOT NULL CHECK (sale_price_paisa >= 0),
    low_stock_threshold_base INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    opening_balance_paisa BIGINT NOT NULL DEFAULT 0,
    credit_limit_paisa BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY,
    customer_id UUID NULL REFERENCES customers(id),
    lines JSONB NOT NULL,
    total_paisa BIGINT NOT NULL CHECK (total_paisa >= 0),
    payment_method TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Stock Movements (append-only)
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    type TEXT NOT NULL,
    quantity_base INTEGER NOT NULL,
    unit_cost_paisa BIGINT NULL,
    reference_id UUID NULL,
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'SYNCED'
);

-- 5. Ledger Entries (append-only)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id),
    type TEXT NOT NULL,
    amount_paisa BIGINT NOT NULL CHECK (amount_paisa >= 0),
    direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    note TEXT NULL,
    sale_id UUID NULL REFERENCES sales(id),
    reversal_of_id UUID NULL,
    reversal_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sync_status TEXT NOT NULL DEFAULT 'SYNCED'
);

-- 6. Processed Operations (idempotency store)
CREATE TABLE IF NOT EXISTS processed_operations (
    operation_id UUID PRIMARY KEY,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response JSONB NULL
);

-- 7. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    details JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance and foreign-key querying
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference_id ON stock_movements(reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_customer_id ON ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_sale_id ON ledger_entries(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_id ON audit_log(operation_id);

-- Append-only trigger function: prevents UPDATE and DELETE on stock_movements and ledger_entries
CREATE OR REPLACE FUNCTION prevent_append_only_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only: UPDATE and DELETE are prohibited', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Apply append-only trigger on stock_movements
DROP TRIGGER IF EXISTS trg_stock_movements_append_only ON stock_movements;
CREATE TRIGGER trg_stock_movements_append_only
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_modification();

-- Apply append-only trigger on ledger_entries
DROP TRIGGER IF EXISTS trg_ledger_entries_append_only ON ledger_entries;
CREATE TRIGGER trg_ledger_entries_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_append_only_modification();
