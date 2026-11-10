/* ============================================================
   Munshi AI — Application State Store (Roman Urdu)
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

    // ---- Rozana Maali Record (KPIs) ----
    cashSalesToday: 38450,
    wasooliToday: 18500,
    nayaUdhaarToday: 6200,
    walletBalance: 24850,
    loadSalesToday: 14200,
    loadProfitToday: 1180,
    loadCountToday: 42,

    // ---- AI Tasdeeq (Pending Confirmation) ----
    pendingAI: {
        customerId: 2,
        customerName: 'Bhai Tariq (Madina Autos)',
        amount: 500,
        type: 'udhaar',
        label: 'Udhaar Diya Gaya',
        rawText: '"Bhai Tariq ko 500 rupay udhaar diya"'
    },

    // ---- Grahak Khata (Customers) ----
    customers: [
        { id: 1, name: 'Chaudhry Bashir', role: 'Darzi Master',         phone: '0300-8541290', balance: 14800, limit: 20000, overdueDays: 34 },
        { id: 2, name: 'Bhai Tariq',      role: 'Madina Autos',          phone: '0301-8847291', balance:  6450, limit: 15000, overdueDays:  0 },
        { id: 3, name: 'Rashid Khan',     role: 'Chai Hotel',            phone: '0333-5129044', balance: 21200, limit: 25000, overdueDays:  0 },
        { id: 4, name: 'Master Zahid',    role: 'Sarkari Ustaad',        phone: '0345-7821903', balance:  3200, limit: 10000, overdueDays:  0 }
    ],

    // ---- Godown Maal (Products) ----
    products: [
        { id: 101, name: 'Mezan Banaspati Ghee (5L)',   category: 'Ghee Aur Tail', unit: 'Peti', cost: 2520, price: 2680, stock: 18,   minStock: 5  },
        { id: 102, name: 'Tapal Danedar Chai (450g)',   category: 'Chai Aur Doodh',unit: 'Dabba',cost:  680, price:  740, stock: 3,    minStock: 10 },
        { id: 103, name: 'Guard Basmati Chawal (10kg)', category: 'Daal Chawal',   unit: 'Bori', cost: 3450, price: 3800, stock: 24,   minStock: 8  },
        { id: 104, name: 'Daal Channa Khas',            category: 'Daal Chawal',   unit: 'KG',   cost:  240, price:  275, stock: 4.5,  minStock: 15 },
        { id: 105, name: "Olper's Doodh (1L Pack)",     category: 'Chai Aur Doodh',unit: 'Dabba',cost:  270, price:  290, stock: 48,   minStock: 12 },
        { id: 106, name: 'Cheeni Saaf Refined',         category: 'Daal Chawal',   unit: 'KG',   cost:  132, price:  145, stock: 65,   minStock: 20 }
    ],

    // ---- POS Bartan (Cart) ----
    cart: [
        { productId: 102, name: 'Tapal Danedar Chai (450g)',   price: 740, qty: 2, unit: 'Dabba' },
        { productId: 106, name: 'Cheeni Saaf Refined',         price: 145, qty: 2, unit: 'KG'   },
        { productId: 105, name: "Olper's Doodh (1L Pack)",     price: 290, qty: 1, unit: 'Dabba' }
    ],

    // ---- Haal Hi Ki Sargarmi (Recent Transactions) ----
    transactions: [
        { id: 1, title: '2kg Cheeni, Tapal Chai, Olpers Doodh', subtitle: 'Naqad Bikri • 10 minute pehle',      amount: 1320, type: 'sale'    },
        { id: 2, title: 'Bhai Tariq (Madina Autos)',             subtitle: 'Wasooli Mili • 25 minute pehle',    amount: 2000, type: 'wasooli' },
        { id: 3, title: 'Chaudhry Bashir',                      subtitle: 'Udhaar Likha • 1 ghanta pehle',     amount:  850, type: 'udhaar'  },
        { id: 4, title: 'Jazz Haftawaar Mega (0301-5582910)',    subtitle: 'Easyload • +Rs. 38 Munafa',         amount:  420, type: 'sale'    }
    ],

    // ---- Mobile Packages (Roman Urdu) ----
    telecomPackages: {
        jazz: [
            { id: 'j1', tag: 'MAHANA',   name: 'Super Duper Offer',    specs: '12GB • 3000 Minutes',  price: 1200, profit: 110 },
            { id: 'j2', tag: 'HAFTAWAAR',name: 'Weekly Mega Sahulat',  specs: '15GB • 7 Din',         price:  420, profit:  38 },
            { id: 'j3', tag: '7 DIN',    name: 'Voice Call Offer',     specs: '1000 Minutes • 1GB',   price:  310, profit:  25 },
            { id: 'j4', tag: 'MAHANA',   name: 'Max Infinity Bundle',  specs: '30GB • Har Network',   price: 1650, profit: 145 }
        ],
        zong: [
            { id: 'z1', tag: 'MAHANA',   name: 'Pro Max 40GB Package', specs: '40GB • 5000 Minutes',  price: 1400, profit: 125 },
            { id: 'z2', tag: 'HAFTAWAAR',name: 'Super Star Haftawaar', specs: '20GB • 7 Din',         price:  460, profit:  42 }
        ],
        ufone: [
            { id: 'u1', tag: 'MAHANA',   name: 'Super Card Gold',      specs: '18GB • Be-hisaab Min', price: 1350, profit: 120 },
            { id: 'u2', tag: 'HAFTAWAAR',name: 'Asli Chhappar Phaar',  specs: '10GB • 7 Din',         price:  380, profit:  34 }
        ],
        telenor: [
            { id: 't1', tag: 'MAHANA',   name: 'EasyCard 1000 Mahana', specs: '15GB • 2500 Minutes',  price: 1050, profit:  95 },
            { id: 't2', tag: 'HAFTAWAAR',name: 'Haftawaar Sahulat',    specs: '8GB • 7 Din',          price:  350, profit:  30 }
        ]
    }
};
