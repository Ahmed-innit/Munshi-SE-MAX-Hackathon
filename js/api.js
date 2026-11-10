/* ============================================================
   Munshi AI — Backend API & Sync Connector
   Integrates Frontend with Express / Postgres Sync Engine
   ============================================================ */

const API_BASE = window.location.port === '3000'
  ? '/api'
  : 'http://localhost:3000/api';

const api = {
  newId() {
    return crypto.randomUUID();
  },

  // Check backend server & database connectivity
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        state.isOnline = data.status === 'ok';
        this.updateOnlineBadge(true);
        return true;
      }
    } catch (e) {
      console.warn('Backend server not reachable, operating offline:', e.message);
    }
    state.isOnline = false;
    this.updateOnlineBadge(false);
    return false;
  },

  updateOnlineBadge(online) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    if (online) {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse';
      text.innerText = 'Online (Live DB)';
      text.className = 'text-[10px] font-semibold text-emerald-700';
    } else {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500';
      text.innerText = 'Offline Ready';
      text.className = 'text-[10px] font-semibold text-amber-700';
    }
  },

  // Fetch current live stock computed from stock_movements
  async loadStock() {
    try {
      const res = await fetch(`${API_BASE}/stock`);
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          state.products = items.map((p) => ({
            id: p.productId,
            name: p.productName,
            category: 'Kiryana',
            unit: p.baseUnit || 'Pack',
            cost: p.purchasePricePaisa ? p.purchasePricePaisa / 100 : 100,
            price: p.salePricePaisa ? p.salePricePaisa / 100 : 120,
            stock: p.currentStock,
            minStock: p.lowStockThresholdBase || 5
          }));
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to load stock from backend:', e);
    }
    return false;
  },

  // Fetch current customer balances computed from ledger_entries
  async loadBalances() {
    try {
      const res = await fetch(`${API_BASE}/balances`);
      if (res.ok) {
        const custs = await res.json();
        if (Array.isArray(custs) && custs.length > 0) {
          state.customers = custs.map((c) => ({
            id: c.customerId,
            name: c.customerName,
            role: 'Kiryana Customer',
            phone: c.phone || '0300-1234567',
            balance: c.balancePaisa / 100,
            limit: 20000,
            overdueDays: 0
          }));
          return true;
        }
      }
    } catch (e) {
      console.error('Failed to load balances from backend:', e);
    }
    return false;
  },

  // Sync operation to POST /api/sync
  async syncOperation(typeOrOp, payload) {
    let reqBody;
    if (typeof typeOrOp === 'object' && typeOrOp !== null && typeOrOp.operationId) {
      reqBody = typeOrOp;
    } else {
      reqBody = {
        operationId: crypto.randomUUID(),
        type: typeOrOp,
        payload,
        createdAt: new Date().toISOString()
      };
    }

    try {
      const res = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error(`Sync operation error:`, err);
      return { ok: false, status: 0, error: err.message };
    }
  },

  // Seeds default products & customers to DB if empty
  async seedIfEmpty() {
    const isOnline = await this.checkHealth();
    if (!isOnline) return;

    const hasStock = await this.loadStock();
    const hasCust = await this.loadBalances();

    if (!hasStock || state.products.length === 0) {
      console.log('Seeding initial products into database...');
      const seedProducts = [
        { id: crypto.randomUUID(), name: 'Mezan Banaspati Ghee (5L)', unit: 'Tin', cost: 2520, price: 2680, stock: 18, minStock: 5 },
        { id: crypto.randomUUID(), name: 'Tapal Danedar Tea (450g)', unit: 'Pack', cost: 680, price: 740, stock: 15, minStock: 10 },
        { id: crypto.randomUUID(), name: 'Guard Basmati Rice (10kg)', unit: 'Bag', cost: 3450, price: 3800, stock: 24, minStock: 8 },
        { id: crypto.randomUUID(), name: 'Dal Channa Special', unit: 'KG', cost: 240, price: 275, stock: 30, minStock: 15 },
        { id: crypto.randomUUID(), name: "Olper's Milk (1L Pack)", unit: 'Pack', cost: 270, price: 290, stock: 48, minStock: 12 },
        { id: crypto.randomUUID(), name: 'Cheeni White (Refined)', unit: 'KG', cost: 132, price: 145, stock: 65, minStock: 20 }
      ];

      for (const p of seedProducts) {
        await this.syncOperation('PRODUCT_UPSERT', {
          id: p.id,
          name: p.name,
          baseUnit: p.unit,
          purchasePricePaisa: p.cost * 100,
          salePricePaisa: p.price * 100,
          lowStockThresholdBase: p.minStock
        });

        if (p.stock > 0) {
          await this.syncOperation('STOCK_PURCHASE', {
            id: crypto.randomUUID(),
            productId: p.id,
            quantityBase: p.stock,
            unitCostPaisa: p.cost * 100,
            reason: 'Opening stock'
          });
        }
      }
      await this.loadStock();
    }

    if (!hasCust || state.customers.length === 0) {
      console.log('Seeding initial customers into database...');
      const seedCustomers = [
        { id: crypto.randomUUID(), name: 'Chaudhry Bashir', phone: '0300-8541290', balance: 14800 },
        { id: crypto.randomUUID(), name: 'Bhai Tariq', phone: '0301-8847291', balance: 6450 },
        { id: crypto.randomUUID(), name: 'Rashid Khan', phone: '0333-5129044', balance: 21200 },
        { id: crypto.randomUUID(), name: 'Master Zahid', phone: '0345-7821903', balance: 3200 }
      ];

      for (const c of seedCustomers) {
        await this.syncOperation('CUSTOMER_UPSERT', {
          id: c.id,
          name: c.name,
          phone: c.phone,
          openingBalancePaisa: c.balance * 100,
          creditLimitPaisa: 2500000
        });
      }
      await this.loadBalances();
    }
  }
};
