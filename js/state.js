/* ============================================================
   Munshi AI — Data Persistence & Storage Layer (Database Engine)
   Persistent, reactive local database with seed data, inventory
   tracking, and strict edge-case validation.
   ============================================================ */

const DB_KEY = 'MUNSHI_AI_DATABASE_V1';

// ---- Default Master Seed Data ----
const INITIAL_SEED_DATA = {
    customers: [
        { id: 1, name: 'Chaudhry Bashir', role: 'Darzi Master',       phone: '0300-8541290', balance: 14800, limit: 20000, overdueDays: 34 },
        { id: 2, name: 'Bhai Tariq',      role: 'Madina Autos',        phone: '0301-8847291', balance:  6450, limit: 15000, overdueDays:  0 },
        { id: 3, name: 'Rashid Khan',     role: 'Chai Hotel',          phone: '0333-5129044', balance: 21200, limit: 25000, overdueDays:  0 },
        { id: 4, name: 'Master Zahid',    role: 'Sarkari Ustaad',      phone: '0345-7821903', balance:  3200, limit: 10000, overdueDays:  0 },
        { id: 5, name: 'Haji Aslam',      role: 'Al-Rehman Medical',   phone: '0321-4412098', balance:     0, limit: 30000, overdueDays:  0 }
    ],
    products: [
        { id: 101, name: 'Mezan Banaspati Ghee (5L)',   aliases: ['mezan ghee', 'ghee', 'mezan', 'tail', 'banaspati'], category: 'Ghee Aur Tail',  unit: 'Peti', cost: 2520, price: 2680, stock: 18,   minStock: 5  },
        { id: 102, name: 'Tapal Danedar Chai (450g)',   aliases: ['tapal chai', 'tapal', 'chai', 'danedar'],           category: 'Chai Aur Doodh', unit: 'Dabba',cost:  680, price:  740, stock: 10,   minStock: 10 },
        { id: 103, name: 'Guard Basmati Chawal (10kg)', aliases: ['guard chawal', 'basmati', 'chawal', 'rice'],       category: 'Daal Chawal',    unit: 'Bori', cost: 3450, price: 3800, stock: 24,   minStock: 8  },
        { id: 104, name: 'Daal Channa Khas',            aliases: ['daal channa', 'daal', 'channa'],                    category: 'Daal Chawal',    unit: 'KG',   cost:  240, price:  275, stock: 15,   minStock: 15 },
        { id: 105, name: "Olper's Doodh (1L Pack)",     aliases: ['olpers', 'doodh', 'milk', 'olper'],                 category: 'Chai Aur Doodh', unit: 'Dabba',cost:  270, price:  290, stock: 48,   minStock: 12 },
        { id: 106, name: 'Cheeni Saaf Refined',         aliases: ['cheeni', 'shakar', 'sugar'],                        category: 'Daal Chawal',    unit: 'KG',   cost:  132, price:  145, stock: 65,   minStock: 20 },
        { id: 107, name: 'National Namak (800g)',       aliases: ['namak', 'national namak', 'salt'],                  category: 'Masalay',        unit: 'Pack', cost:   60, price:   70, stock: 35,   minStock: 10 },
        { id: 108, name: 'Shan Biryani Masala',         aliases: ['shan masala', 'biryani masala', 'masala'],          category: 'Masalay',        unit: 'Dabba',cost:  110, price:  130, stock: 40,   minStock: 10 }
    ],
    cart: [
        { productId: 102, name: 'Tapal Danedar Chai (450g)', price: 740, qty: 2, unit: 'Dabba' },
        { productId: 106, name: 'Cheeni Saaf Refined',       price: 145, qty: 2, unit: 'KG'   }
    ],
    transactions: [
        { id: 1, title: '2kg Cheeni, 1 Tapal Chai',              subtitle: 'Naqad Bikri • 10 minute pehle',      amount: 1030, type: 'sale'    },
        { id: 2, title: 'Bhai Tariq (Madina Autos)',             subtitle: 'Wasooli Mili • 25 minute pehle',    amount: 2000, type: 'wasooli' },
        { id: 3, title: 'Chaudhry Bashir',                      subtitle: 'Udhaar Likha • 1 ghanta pehle',     amount:  850, type: 'udhaar'  },
        { id: 4, title: 'Jazz Haftawaar Mega (0301-5582910)',    subtitle: 'Easyload • +Rs. 38 Munafa',         amount:  420, type: 'sale'    }
    ],
    kpis: {
        cashSalesToday: 38450,
        wasooliToday: 18500,
        nayaUdhaarToday: 6200,
        walletBalance: 24850,
        loadSalesToday: 14200,
        loadProfitToday: 1180,
        loadCountToday: 42
    }
};

// Database Service Interface
const db = {
    load() {
        try {
            const raw = localStorage.getItem(DB_KEY);
            if (!raw) {
                this.save(INITIAL_SEED_DATA);
                return JSON.parse(JSON.stringify(INITIAL_SEED_DATA));
            }
            const parsed = JSON.parse(raw);
            // Merge checks if keys missing
            return {
                customers: parsed.customers || INITIAL_SEED_DATA.customers,
                products: parsed.products || INITIAL_SEED_DATA.products,
                cart: parsed.cart || [],
                transactions: parsed.transactions || INITIAL_SEED_DATA.transactions,
                kpis: parsed.kpis || INITIAL_SEED_DATA.kpis
            };
        } catch (e) {
            console.error('Database load error, resetting to seed data:', e);
            return JSON.parse(JSON.stringify(INITIAL_SEED_DATA));
        }
    },

    save(data) {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    },

    resetToSeed() {
        localStorage.removeItem(DB_KEY);
        this.save(INITIAL_SEED_DATA);
        location.reload();
    }
};

// Load database directly into reactive state
const stored = db.load();

const state = {
    // UI State
    activeTab: 'home',
    isOnline: true,
    isRecording: false,
    homeTxFilter: 'all',
    stockCategory: 'all',
    udhaarFilter: 'all',

    // POS State
    posCustomerMode: 'walkin',
    posCustomerId: 2,
    posPaymentMode: 'cash',

    // Packages State
    pkgNetwork: 'jazz',
    pkgMode: 'bundle',
    pkgSelectedBundleId: 'j1',
    pkgPayMode: 'cash',

    // Synced reactive records from Database
    cashSalesToday: stored.kpis.cashSalesToday,
    wasooliToday: stored.kpis.wasooliToday,
    nayaUdhaarToday: stored.kpis.nayaUdhaarToday,
    walletBalance: stored.kpis.walletBalance,
    loadSalesToday: stored.kpis.loadSalesToday,
    loadProfitToday: stored.kpis.loadProfitToday,
    loadCountToday: stored.kpis.loadCountToday,

    customers: stored.customers,
    products: stored.products,
    cart: stored.cart,
    transactions: stored.transactions,

    // AI Tasdeeq Object (null or verification card)
    pendingAI: null,

    // Mobile Packages
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

// Global helper to persist state changes to database
function persistDB() {
    db.save({
        customers: state.customers,
        products: state.products,
        cart: state.cart,
        transactions: state.transactions,
        kpis: {
            cashSalesToday: state.cashSalesToday,
            wasooliToday: state.wasooliToday,
            nayaUdhaarToday: state.nayaUdhaarToday,
            walletBalance: state.walletBalance,
            loadSalesToday: state.loadSalesToday,
            loadProfitToday: state.loadProfitToday,
            loadCountToday: state.loadCountToday
        }
    });
}
