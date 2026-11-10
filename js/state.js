/* ============================================================
   Munshi AI — Application State Store
   Loaded with Official SRS §1.5 Dataset (Valid UUIDs & Paisa)
   ============================================================ */

const state = {
    // ---- UI State ----
    activeTab: 'home',
    isOnline: true,
    isRecording: false,
    homeTxFilter: 'all',
    stockCategory: 'all',
    udhaarFilter: 'all',

    // ---- POS State ----
    posCustomerMode: 'walkin',
    posCustomerId: '00000000-0000-4000-8000-000000000101', // Ali
    posPaymentMode: 'cash',

    // ---- Packages State ----
    pkgNetwork: 'jazz',
    pkgMode: 'bundle',
    pkgSelectedBundleId: 'j1',
    pkgPayMode: 'cash',

    // ---- KPI Counters ----
    cashSalesToday: 0,
    wasooliToday: 0,
    nayaUdhaarToday: 0,
    walletBalance: 25000,
    loadSalesToday: 0,
    loadProfitToday: 0,
    loadCountToday: 0,

    // ---- AI Pending Confirmation (SRS TC-PAR-03) ----
    pendingAI: null,

    // ---- Customer Ledger (SRS Section 1.5 Seed Customers) ----
    customers: [
        { id: '00000000-0000-4000-8000-000000000101', name: 'Ali',             role: 'Regular Buyer',  phone: '0300-1111111', balance:     0, limit:  5000, overdueDays: 0 },
        { id: '00000000-0000-4000-8000-000000000102', name: 'Ahmed',           role: 'Neighbor',       phone: '0300-2222222', balance:     0, limit:  2000, overdueDays: 0 },
        { id: '00000000-0000-4000-8000-000000000103', name: 'Ahmed Khan',      role: 'Shop Regular',   phone: '0300-3333333', balance:     0, limit:  2000, overdueDays: 0 },
        { id: '00000000-0000-4000-8000-000000000104', name: 'Bilal',           role: 'Student',        phone: '0300-4444444', balance:     0, limit:  1000, overdueDays: 0 },
        { id: '00000000-0000-4000-8000-000000000105', name: 'Chaudhry Bashir', role: 'Tailor Master',  phone: '0300-8541290', balance: 14800, limit: 20000, overdueDays: 34 },
        { id: '00000000-0000-4000-8000-000000000106', name: 'Bhai Tariq',      role: 'Al-Madina Autos',phone: '0301-8847291', balance:  6450, limit: 15000, overdueDays: 0 },
        { id: '00000000-0000-4000-8000-000000000107', name: 'Rashid Khan',     role: 'Chai Dhabba',    phone: '0333-5129044', balance: 21200, limit: 25000, overdueDays: 0 },
        { id: '00000000-0000-4000-8000-000000000108', name: 'Master Zahid',    role: 'Govt Teacher',   phone: '0345-7821903', balance:  3200, limit: 10000, overdueDays: 0 }
    ],

    // ---- Product / Inventory (SRS Section 1.5 Seed Products) ----
    products: [
        { id: '00000000-0000-4000-8000-000000000001', name: 'Basmati Chawal',       category: 'Grains',    unit: 'kg',     cost:  250, price:  300, stock: 20, minStock:  5 },
        { id: '00000000-0000-4000-8000-000000000002', name: 'Aata',                 category: 'Flour',     unit: 'kg',     cost:  120, price:  150, stock: 50, minStock: 10 },
        { id: '00000000-0000-4000-8000-000000000003', name: 'Cheeni',               category: 'Sugar',     unit: 'kg',     cost:  160, price:  180, stock: 30, minStock:  5 },
        { id: '00000000-0000-4000-8000-000000000004', name: 'Doodh',                category: 'Dairy',     unit: 'litre',  cost:  180, price:  200, stock: 20, minStock:  5 },
        { id: '00000000-0000-4000-8000-000000000005', name: 'Coke bottle',          category: 'Beverage',  unit: 'piece',  cost:   80, price:  100, stock: 48, minStock: 12 },
        { id: '00000000-0000-4000-8000-000000000006', name: 'Sabun packet',         category: 'Household', unit: 'packet', cost:  100, price:  120, stock: 30, minStock:  6 },
        { id: '00000000-0000-4000-8000-000000000007', name: 'Dal Channa Special',   category: 'Grains',    unit: 'kg',     cost:  240, price:  275, stock: 30, minStock: 15 },
        { id: '00000000-0000-4000-8000-000000000008', name: 'Mezan Banaspati Ghee', category: 'Ghee',      unit: 'tin',    cost: 2520, price: 2680, stock: 18, minStock:  5 },
        { id: '00000000-0000-4000-8000-000000000009', name: 'Tapal Danedar Tea',    category: 'Tea',       unit: 'pack',   cost:  680, price:  740, stock: 15, minStock: 10 },
        { id: '00000000-0000-4000-8000-000000000010', name: "Olper's Milk",         category: 'Dairy',     unit: 'pack',   cost:  270, price:  290, stock: 48, minStock: 12 }
    ],

    // ---- POS Cart ----
    cart: [
        { productId: '00000000-0000-4000-8000-000000000001', name: 'Basmati Chawal', price: 300, qty: 2, unit: 'kg' },
        { productId: '00000000-0000-4000-8000-000000000003', name: 'Cheeni',         price: 180, qty: 1, unit: 'kg' }
    ],

    // ---- Recent Transactions Feed ----
    transactions: [],

    // ---- Telecom Packages ----
    telecomPackages: {
        jazz: [
            { id: 'j1', tag: 'MONTHLY', name: 'Super Duper',    specs: '12GB • 3000 Min',   price: 1200, profit: 110 },
            { id: 'j2', tag: 'WEEKLY',  name: 'Weekly Mega',    specs: '15GB • 7 Days',     price:  420, profit:  38 },
            { id: 'j3', tag: '7 DAYS',  name: 'Voice Offer',    specs: '1000 Min • 1GB',    price:  310, profit:  25 },
            { id: 'j4', tag: 'MONTHLY', name: 'Max Infinity',   specs: '30GB • All-Net',    price: 1650, profit: 145 }
        ],
        zong: [
            { id: 'z1', tag: 'MONTHLY', name: 'Pro Max 40GB',  specs: '40GB • 5000 Min',   price: 1400, profit: 125 },
            { id: 'z2', tag: 'WEEKLY',  name: 'Super Star',    specs: '20GB • 7 Days',     price:  460, profit:  42 }
        ],
        ufone: [
            { id: 'u1', tag: 'MONTHLY', name: 'Super Card Gold',       specs: '18GB • Unlimited',  price: 1350, profit: 120 },
            { id: 'u2', tag: 'WEEKLY',  name: 'Asli Chappar Phaar',    specs: '10GB • 7 Days',     price:  380, profit:  34 }
        ],
        telenor: [
            { id: 't1', tag: 'MONTHLY', name: 'EasyCard 1000',         specs: '15GB • 2500 Min',   price: 1050, profit:  95 },
            { id: 't2', tag: 'WEEKLY',  name: 'Haftawar Sahulat',      specs: '8GB • 7 Days',      price:  350, profit:  30 }
        ]
    }
};
