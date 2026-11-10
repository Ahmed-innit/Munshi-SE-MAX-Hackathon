/* ============================================================
   Munshi AI — Stock / Godown (Inventory) View
   ============================================================ */

function setStockCategory(cat) {
    state.stockCategory = cat;
    document.querySelectorAll('.stock-cat-btn').forEach(btn => {
        btn.className = btn.dataset.cat === cat
            ? 'stock-cat-btn shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900 text-white'
            : 'stock-cat-btn shrink-0 px-4 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600';
    });
    renderStock();
}

function adjustStock(id, delta) {
    const prod = state.products.find(p => p.id === id);
    if (!prod) return;
    prod.stock = Math.max(0, +(prod.stock + delta).toFixed(1));
    renderAll();
}

function renderStock() {
    const query    = (document.getElementById('stock-search')?.value || '').toLowerCase();
    const filtered = state.products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query);
        if (!matchSearch) return false;
        if (state.stockCategory === 'all')  return true;
        if (state.stockCategory === 'low')  return p.stock <= p.minStock;
        return p.category === state.stockCategory;
    });

    // Recalculate KPIs from full product list
    let totalCost   = 0, totalRetail = 0, lowCount = 0;
    state.products.forEach(p => {
        totalCost   += p.cost  * p.stock;
        totalRetail += p.price * p.stock;
        if (p.stock <= p.minStock) lowCount++;
    });

    document.getElementById('stock-kpi-count').innerText  = `${state.products.length} Items`;
    document.getElementById('stock-kpi-low').innerText    = `${lowCount} Alerts`;
    document.getElementById('stock-kpi-cost').innerText   = `Rs. ${Math.round(totalCost).toLocaleString()}`;
    document.getElementById('stock-kpi-retail').innerText = `Rs. ${Math.round(totalRetail).toLocaleString()}`;

    document.getElementById('stock-items-list').innerHTML = filtered.map(p => {
        const isLow  = p.stock <= p.minStock;
        const profit = p.price - p.cost;
        const badge  = isLow
            ? `<span class="text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">Low: ${p.stock} ${p.unit}</span>`
            : `<span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">${p.stock} ${p.unit} in stock</span>`;

        return `
            <div class="soft-card p-4 rounded-2xl space-y-3 ${isLow ? 'border-red-100' : ''} slide-up">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <h4 class="font-semibold text-sm text-slate-900">${p.name}</h4>
                        <p class="text-xs text-slate-400 mt-0.5">${p.category} • Per ${p.unit}</p>
                    </div>
                    ${badge}
                </div>
                <div class="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center">
                    <div>
                        <span class="text-[10px] text-slate-400 block">Cost</span>
                        <span class="text-xs font-semibold text-slate-700">Rs. ${p.cost}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 block">Retail</span>
                        <span class="text-xs font-bold text-slate-900">Rs. ${p.price}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 block">Margin</span>
                        <span class="text-xs font-bold text-emerald-600">+Rs. ${profit}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center pt-1">
                    <button onclick="addProductToPos(${p.id})"
                        class="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 active:scale-95 transition-transform">
                        <span class="material-symbols-outlined text-[15px]">add_shopping_cart</span> Add to POS Bill
                    </button>
                    <div class="flex items-center gap-2 bg-slate-100 rounded-xl p-1">
                        <button onclick="adjustStock(${p.id}, -1)"
                            class="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center shadow-xs active:scale-90 transition-transform">
                            <span class="material-symbols-outlined text-[16px]">remove</span>
                        </button>
                        <span class="text-xs font-bold text-slate-900 min-w-[28px] text-center">${p.stock}</span>
                        <button onclick="adjustStock(${p.id}, 1)"
                            class="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs active:scale-90 transition-transform">
                            <span class="material-symbols-outlined text-[16px]">add</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openNewProductModal() {
    document.getElementById('modal-new-product').classList.remove('hidden');
    document.getElementById('modal-new-product').classList.add('flex');
}

function submitNewProduct() {
    const name  = document.getElementById('new-prod-name').value.trim();
    const cat   = document.getElementById('new-prod-cat').value;
    const unit  = document.getElementById('new-prod-unit').value.trim() || 'Pack';
    const cost  = parseFloat(document.getElementById('new-prod-cost').value)  || 100;
    const sell  = parseFloat(document.getElementById('new-prod-sell').value)  || 120;
    const stock = parseFloat(document.getElementById('new-prod-stock').value) || 10;

    if (!name) return showToast('Please enter product name');

    state.products.unshift({ id: Date.now(), name, category: cat, unit, cost, price: sell, stock, minStock: 5 });
    closeModal('modal-new-product');
    renderAll();
    showToast(`${name} added to Godown!`);
}

function simulateBarcodeScan(context) {
    const rnd = state.products[Math.floor(Math.random() * state.products.length)];
    if (context === 'pos') {
        addProductToPos(rnd.id);
    } else {
        document.getElementById('stock-search').value = rnd.name.split(' ')[0];
        renderStock();
        showToast(`Scanned Barcode: ${rnd.name}`);
    }
}

