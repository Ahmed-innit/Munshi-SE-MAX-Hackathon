-- 1. Seed Shop Meta
INSERT INTO shop_meta (id, shop_name, owner_name, location, wallet_balance)
VALUES (1, 'Madina Kiryana', 'Haji Tariq', 'G-9 Markaz Islamabad', 24850.00)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Customers
INSERT INTO customers (id, name, role, phone, balance, credit_limit, overdue_days) VALUES
(1, 'Chaudhry Bashir', 'Tailor Master', '0300-8541290', 14800.00, 20000.00, 34),
(2, 'Bhai Tariq', 'Al-Madina Autos', '0301-8847291', 6450.00, 15000.00, 0),
(3, 'Rashid Khan', 'Chai Dhabba', '0333-5129044', 21200.00, 25000.00, 0),
(4, 'Master Zahid', 'Govt School Teacher', '0345-7821903', 3200.00, 10000.00, 0)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for customers
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));

-- 3. Seed Products
INSERT INTO products (id, name, category, unit, cost_price, retail_price, stock, min_stock) VALUES
(101, 'Mezan Banaspati Ghee (5L)', 'Ghee & Oil', 'Tin', 2520.00, 2680.00, 18.0, 5.0),
(102, 'Tapal Danedar Tea (450g)', 'Tea & Dairy', 'Pack', 680.00, 740.00, 3.0, 10.0),
(103, 'Guard Basmati Rice (10kg)', 'Grain & Pulses', 'Bag', 3450.00, 3800.00, 24.0, 8.0),
(104, 'Dal Channa Special', 'Grain & Pulses', 'KG', 240.00, 275.00, 4.5, 15.0),
(105, 'Olper''s Milk (1L Pack)', 'Tea & Dairy', 'Pack', 270.00, 290.00, 48.0, 12.0),
(106, 'Cheeni White (Refined)', 'Grain & Pulses', 'KG', 132.00, 145.00, 65.0, 20.0)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence for products
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- 4. Seed Recent Transactions
INSERT INTO transactions (id, customer_id, title, subtitle, amount, type, payment_method) VALUES
(1, NULL, '2kg Cheeni, Tapal Tea, Olpers', 'Naqad Bikri • 10m ago', 1320.00, 'sale', 'cash'),
(2, 2, 'Bhai Tariq (Al-Madina)', 'Wasooli Received • 25m ago', 2000.00, 'wasooli', 'cash'),
(3, 1, 'Chaudhry Bashir', 'Udhaar Darj • 1h ago', 850.00, 'udhaar', 'udhaar'),
(4, NULL, 'Jazz Weekly Mega (0301-5582910)', 'Easyload • +Rs. 38 Profit', 420.00, 'sale', 'cash')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Telecom Bundles
INSERT INTO telecom_packages (id, network, tag, name, specs, price, profit) VALUES
('j1', 'jazz', 'MONTHLY', 'Super Duper', '12GB • 3000 Min', 1200.00, 110.00),
('j2', 'jazz', 'WEEKLY', 'Weekly Mega', '15GB • 7 Days', 420.00, 38.00),
('j3', 'jazz', '7 DAYS', 'Voice Offer', '1000 Min • 1GB', 310.00, 25.00),
('j4', 'jazz', 'MONTHLY', 'Max Infinity', '30GB • All-Net', 1650.00, 145.00),
('z1', 'zong', 'MONTHLY', 'Pro Max 40GB', '40GB • 5000 Min', 1400.00, 125.00),
('z2', 'zong', 'WEEKLY', 'Super Star', '20GB • 7 Days', 460.00, 42.00),
('u1', 'ufone', 'MONTHLY', 'Super Card Gold', '18GB • Unlimited', 1350.00, 120.00),
('u2', 'ufone', 'WEEKLY', 'Asli Chappar Phaar', '10GB • 7 Days', 380.00, 34.00),
('t1', 'telenor', 'MONTHLY', 'EasyCard 1000', '15GB • 2500 Min', 1050.00, 95.00),
('t2', 'telenor', 'WEEKLY', 'Haftawar Sahulat', '8GB • 7 Days', 350.00, 30.00)
ON CONFLICT (id) DO NOTHING;