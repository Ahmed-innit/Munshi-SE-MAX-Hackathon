/* ============================================================
   Munshi AI — Backend API & Sync Connector
   Integrates Frontend with Express / Postgres Sync Engine
   ============================================================ */

/* ============================================================
   Munshi AI — Offline-First Sync & Outbox Engine
   Connects Local Device (IndexedDB/LocalStorage) to Supabase Cloud
   ============================================================ */

const API_BASE = window.location.port === '3000'
  ? '/api'
  : 'http://localhost:3000/api';

const OUTBOX_KEY = 'munshi_sync_outbox';
const CACHE_PRODUCTS_KEY = 'munshi_cache_products';
const CACHE_CUSTOMERS_KEY = 'munshi_cache_customers';

const api = {
  isFlushing: false,

  newId() {
    return crypto.randomUUID();
  },

  // 1. Local Outbox Management (Offline-First Queue)
  getOutbox() {
    try {
      return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    } catch {
      return [];
    }
  },

  saveOutbox(queue) {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('Failed to save outbox to localStorage:', e);
    }
    this.updateOnlineBadge(state.isOnline);
  },

  enqueue(typeOrOp, payload) {
    const queue = this.getOutbox();
    let item;
    if (typeof typeOrOp === 'object' && typeOrOp !== null && typeOrOp.operationId) {
      item = {
        operationId: typeOrOp.operationId,
        type: typeOrOp.type,
        payload: typeOrOp.payload,
        createdAt: typeOrOp.createdAt || new Date().toISOString(),
        attempts: 0,
        status: 'PENDING',
        lastError: null
      };
    } else {
      item = {
        operationId: crypto.randomUUID(),
        type: typeOrOp,
        payload: payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: 'PENDING',
        lastError: null
      };
    }
    queue.push(item);
    this.saveOutbox(queue);
    return item;
  },

  // 2. Health & Connectivity Check
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        state.isOnline = data.status === 'ok';
        this.updateOnlineBadge(true);
        return true;
      }
    } catch (e) {
      console.warn('Backend server not reachable, running in offline mode:', e.message);
    }
    state.isOnline = false;
    this.updateOnlineBadge(false);
    return false;
  },

  updateOnlineBadge(online) {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (!dot || !text) return;

    const outbox = this.getOutbox();
    const pendingCount = outbox.filter(i => i.status === 'PENDING').length;
    const reviewCount = outbox.filter(i => i.status === 'NEEDS_REVIEW').length;

    if (reviewCount > 0) {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse';
      text.innerText = `Needs Review (${reviewCount})`;
      text.className = 'text-[10px] font-semibold text-red-600';
    } else if (online) {
      if (pendingCount > 0) {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse';
        text.innerText = `Syncing (${pendingCount})`;
        text.className = 'text-[10px] font-semibold text-blue-600';
      } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse';
        text.innerText = 'Online (Supabase)';
        text.className = 'text-[10px] font-semibold text-emerald-700';
      }
    } else {
      dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500';
      text.innerText = pendingCount > 0 ? `Offline (${pendingCount} saved)` : 'Offline Ready';
      text.className = 'text-[10px] font-semibold text-amber-700';
    }
  },

  // 3. Fetch Stock (Online from Supabase, or fallback to offline cache)
  async loadStock() {
    try {
      const res = await fetch(`${API_BASE}/stock`, { signal: AbortSignal.timeout(4000) });
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
          // Save to local offline cache
          try { localStorage.setItem(CACHE_PRODUCTS_KEY, JSON.stringify(state.products)); } catch {}
          return true;
        }
      }
    } catch (e) {
      console.warn('Could not load live stock from server, using offline cache:', e.message);
    }

    // Offline fallback from local cache
    try {
      const cached = localStorage.getItem(CACHE_PRODUCTS_KEY);
      if (cached) {
        state.products = JSON.parse(cached);
        return true;
      }
    } catch {}
    return false;
  },

  // 4. Fetch Balances (Online from Supabase, or fallback to offline cache)
  async loadBalances() {
    try {
      const res = await fetch(`${API_BASE}/balances`, { signal: AbortSignal.timeout(4000) });
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
          // Save to local offline cache
          try { localStorage.setItem(CACHE_CUSTOMERS_KEY, JSON.stringify(state.customers)); } catch {}
          return true;
        }
      }
    } catch (e) {
      console.warn('Could not load live balances from server, using offline cache:', e.message);
    }

    // Offline fallback from local cache
    try {
      const cached = localStorage.getItem(CACHE_CUSTOMERS_KEY);
      if (cached) {
        state.customers = JSON.parse(cached);
        return true;
      }
    } catch {}
    return false;
  },

  // 5. Enqueue & Sync Operation
  async syncOperation(typeOrOp, payload) {
    // 1. Always enqueue to local persistent outbox first (instant offline safety)
    const item = this.enqueue(typeOrOp, payload);

    // 2. If online, immediately flush to Supabase
    if (navigator.onLine) {
      return await this.flushOutbox();
    } else {
      state.isOnline = false;
      this.updateOnlineBadge(false);
      return { ok: true, status: 200, offline: true, data: { status: 'queued', operationId: item.operationId } };
    }
  },

  // 6. Flush Outbox in sequential order (RFC sync protocol)
  async flushOutbox() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const isOnline = await this.checkHealth();
      if (!isOnline) {
        this.updateOnlineBadge(false);
        return;
      }

      let queue = this.getOutbox();
      const pendingItems = queue.filter(item => item.status === 'PENDING');
      if (pendingItems.length === 0) return;

      this.updateOnlineBadge(true);

      for (const item of pendingItems) {
        item.status = 'IN_FLIGHT';
        item.attempts += 1;
        this.saveOutbox(queue);

        try {
          const res = await fetch(`${API_BASE}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operationId: item.operationId,
              type: item.type,
              payload: item.payload,
              createdAt: item.createdAt
            })
          });

          const data = await res.json();

          if (res.ok && data.status === 'ok') {
            item.status = 'SYNCED';
            item.lastError = null;
          } else if (data.status === 'rejected') {
            // Server rejection (e.g. NEGATIVE_STOCK, UNKNOWN_CUSTOMER):
            // Mark NEEDS_REVIEW, do not alter client data, notify user
            item.status = 'NEEDS_REVIEW';
            item.lastError = `${data.code}: ${data.reason}`;
            console.warn(`[Sync Outbox] Operation ${item.operationId} rejected: ${data.reason}`);
            if (typeof showToast === 'function') {
              showToast(`Needs Review: ${data.reason || data.code}`);
            }
          } else {
            // Transient 5xx or server error: keep PENDING for retry
            item.status = 'PENDING';
            item.lastError = data.message || 'Server error';
            break;
          }
        } catch (netErr) {
          // Network disconnected during sync: keep PENDING and resume later
          item.status = 'PENDING';
          item.lastError = netErr.message;
          state.isOnline = false;
          this.updateOnlineBadge(false);
          break;
        }
      }

      // Prune successfully synced items, leave NEEDS_REVIEW for user inspection
      queue = queue.filter(item => item.status !== 'SYNCED');
      this.saveOutbox(queue);

      // Re-fetch authoritative stock & balances from Supabase
      await this.loadStock();
      await this.loadBalances();
      if (typeof renderAll === 'function') renderAll();
    } finally {
      this.isFlushing = false;
      this.updateOnlineBadge(state.isOnline);
    }
  },

  // 7. Seed initial catalog & khata if DB is empty
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

// Auto-sync whenever internet connectivity is restored
window.addEventListener('online', () => {
  if (window.api) {
    api.flushOutbox();
  }
});


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
