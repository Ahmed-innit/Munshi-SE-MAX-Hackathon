-- Drop tables if resetting
DROP TABLE IF EXISTS pos_order_items CASCADE;
DROP TABLE IF EXISTS pos_orders CASCADE;
DROP TABLE IF EXISTS telecom_packages CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS shop_meta CASCADE;

-- 1. Shop Metadata & Retailer Wallet
CREATE TABLE shop_meta (
    id SERIAL PRIMARY KEY,
    shop_name VARCHAR(150) NOT NULL DEFAULT 'Madina Kiryana',
    owner_name VARCHAR(100) NOT NULL DEFAULT 'Haji Tariq',
    location VARCHAR(200) DEFAULT 'G-9 Markaz Islamabad',
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 24850.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers (Udhaar Book)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) DEFAULT 'Regular Customer',
    phone VARCHAR(30) NOT NULL,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 20000.00,
    overdue_days INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products (Godown Inventory)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL, -- 'Grain & Pulses', 'Ghee & Oil', 'Tea & Dairy'
    unit VARCHAR(20) NOT NULL DEFAULT 'Pack', -- 'Pack', 'KG', 'Tin', 'Bag'
    cost_price NUMERIC(10, 2) NOT NULL,
    retail_price NUMERIC(10, 2) NOT NULL,
    stock NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_stock NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Transactions (Daily Activity & Ledger Feed)
CREATE TABLE transactions (
    id BIGINT PRIMARY KEY, -- Supports JS Date.now() timestamp IDs
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    amount NUMERIC(12, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'wasooli', 'udhaar')),
    payment_method VARCHAR(20) DEFAULT 'cash', -- 'cash', 'udhaar', 'split', 'raast'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Telecom Packages (Easyload / Mobile Bundles)
CREATE TABLE telecom_packages (
    id VARCHAR(20) PRIMARY KEY, -- e.g. 'j1', 'z1'
    network VARCHAR(20) NOT NULL, -- 'jazz', 'zong', 'ufone', 'telenor'
    tag VARCHAR(50) NOT NULL,     -- 'MONTHLY', 'WEEKLY', '7 DAYS'
    name VARCHAR(100) NOT NULL,
    specs VARCHAR(100) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    profit NUMERIC(10, 2) NOT NULL
);