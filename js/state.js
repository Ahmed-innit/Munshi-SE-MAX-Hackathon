/* ============================================================
   Munshi AI — Application State Store
   Central source of truth for all reactive data
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
    posCustomerId: 2,
    posPaymentMode: 'cash',

    // ---- Packages State ----
    pkgNetwork: 'jazz',
    pkgMode: 'bundle',
    pkgSelectedBundleId: 'j1',
    pkgPayMode: 'cash',

    // ---- KPI Counters ----
    cashSalesToday: 38450,
    wasooliToday: 18500,
    nayaUdhaarToday: 6200,
    walletBalance: 24850,
    loadSalesToday: 14200,
    loadProfitToday: 1180,
    loadCountToday: 42,

    // ---- AI Pending Confirmation ----
    pendingAI: {
        customerId: 2,
        customerName: 'Bhai Tariq (Al-Madina Autos)',
        amount: 500,
        type: 'udhaar',
        label: 'Udhaar Diya',
        rawText: '"Bhai Tariq ko 500 rupay udhaar diya"'
    },

    // ---- Customer Ledger ----
    customers: [
        { id: 1, name: 'Chaudhry Bashir', role: 'Tailor Master',         phone: '0300-8541290', balance: 14800, limit: 20000, overdueDays: 34 },
        { id: 2, name: 'Bhai Tariq',      role: 'Al-Madina Autos',       phone: '0301-8847291', balance:  6450, limit: 15000, overdueDays:  0 },
        { id: 3, name: 'Rashid Khan',     role: 'Chai Dhabba',           phone: '0333-5129044', balance: 21200, limit: 25000, overdueDays:  0 },
        { id: 4, name: 'Master Zahid',    role: 'Govt School Teacher',   phone: '0345-7821903', balance:  3200, limit: 10000, overdueDays:  0 }
    ],

    // ---- Product / Inventory ----
    products: [
        { id: 101, name: 'Mezan Banaspati Ghee (5L)',   category: 'Ghee & Oil',     unit: 'Tin',  cost: 2520, price: 2680, stock: 18,   minStock: 5  },
        { id: 102, name: 'Tapal Danedar Tea (450g)',    category: 'Tea & Dairy',    unit: 'Pack', cost:  680, price:  740, stock: 3,    minStock: 10 },
        { id: 103, name: 'Guard Basmati Rice (10kg)',   category: 'Grain & Pulses', unit: 'Bag',  cost: 3450, price: 3800, stock: 24,   minStock: 8  },
        { id: 104, name: 'Dal Channa Special',          category: 'Grain & Pulses', unit: 'KG',   cost:  240, price:  275, stock: 4.5,  minStock: 15 },
        { id: 105, name: "Olper's Milk (1L Pack)",      category: 'Tea & Dairy',    unit: 'Pack', cost:  270, price:  290, stock: 48,   minStock: 12 },
        { id: 106, name: 'Cheeni White (Refined)',      category: 'Grain & Pulses', unit: 'KG',   cost:  132, price:  145, stock: 65,   minStock: 20 }
    ],

    // ---- POS Cart ----
    cart: [
        { productId: 102, name: 'Tapal Danedar Tea (450g)',   price: 740, qty: 2, unit: 'Pack' },
        { productId: 106, name: 'Cheeni White (Refined)',      price: 145, qty: 2, unit: 'KG'   },
        { productId: 105, name: "Olper's Milk (1L Pack)",      price: 290, qty: 1, unit: 'Pack' }
    ],

    // ---- Recent Transactions Feed ----
    transactions: [
        { id: 1, title: '2kg Cheeni, Tapal Tea, Olpers',          subtitle: 'Naqad Bikri • 10m ago',           amount: 1320, type: 'sale'    },
        { id: 2, title: 'Bhai Tariq (Al-Madina)',                  subtitle: 'Wasooli Received • 25m ago',      amount: 2000, type: 'wasooli' },
        { id: 3, title: 'Chaudhry Bashir',                         subtitle: 'Udhaar Darj • 1h ago',            amount:  850, type: 'udhaar'  },
        { id: 4, title: 'Jazz Weekly Mega (0301-5582910)',         subtitle: 'Easyload • +Rs. 38 Profit',       amount:  420, type: 'sale'    }
    ],

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

