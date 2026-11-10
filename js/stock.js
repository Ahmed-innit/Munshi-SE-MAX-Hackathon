/* ============================================================
   Munshi AI — Godown / Stock View (Roman Urdu)
   Connected with Database Persistence & Validation
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
    persistDB();
    renderAll();
}

function renderStock() {
    const query = (document.getElementById('stock-search')?.value || '').toLowerCase();
    const filtered = state.products.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(query) || 
                            p.category.toLowerCase().includes(query) ||
                            (p.aliases && p.aliases.some(a => a.includes(query)));
        if (!matchSearch) return false;
        if (state.stockCategory === 'all')  return true;
        if (state.stockCategory === 'low')  return p.stock <= p.minStock;
        return p.category === state.stockCategory;
    });

    let totalCost = 0, totalRetail = 0, lowCount = 0;
    state.products.forEach(p => {
        totalCost   += p.cost  * p.stock;
        totalRetail += p.price * p.stock;
        if (p.stock <= p.minStock) lowCount++;
    });

    const countEl = document.getElementById('stock-kpi-count');
    const lowEl = document.getElementById('stock-kpi-low');
    const costEl = document.getElementById('stock-kpi-cost');
    const retEl = document.getElementById('stock-kpi-retail');
    const listEl = document.getElementById('stock-items-list');

    if (countEl) countEl.innerText  = `${state.products.length} Cheezein`;
    if (lowEl) lowEl.innerText    = `${lowCount} Khatam Honay Wali`;
    if (costEl) costEl.innerText   = `Rs. ${Math.round(totalCost).toLocaleString()}`;
    if (retEl) retEl.innerText = `Rs. ${Math.round(totalRetail).toLocaleString()}`;

    if (!listEl) return;

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="soft-card p-6 rounded-2xl text-center space-y-2">
                <span class="material-symbols-outlined text-amber-500 text-3xl">inventory</span>
                <p class="font-bold text-sm text-slate-800">Database Mein Aesi Koi Cheez Nahi Mili</p>
                <p class="text-xs text-slate-500">Aap naya maal shamil kar saktay hain ya search tabdeel karein.</p>
                <button onclick="openNewProductModal()" class="mt-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl">
                    + Nayi Cheez Database Mein Daalein
                </button>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(p => {
        const isLow  = p.stock <= p.minStock;
        const profit = p.price - p.cost;
        const badge  = isLow
            ? `<span class="text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">Kam Hai: ${p.stock} ${p.unit}</span>`
            : `<span class="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">${p.stock} ${p.unit} Mojood Hai</span>`;

        return `
            <div class="soft-card p-4 rounded-2xl space-y-3 ${isLow ? 'border-red-100' : ''} slide-up">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <h4 class="font-semibold text-sm text-slate-900">${p.name}</h4>
                        <p class="text-xs text-slate-400 mt-0.5">${p.category} • Fi ${p.unit}</p>
                    </div>
                    ${badge}
                </div>
                <div class="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center">
                    <div>
                        <span class="text-[10px] text-slate-400 block">Kharid Rate</span>
                        <span class="text-xs font-semibold text-slate-700">Rs. ${p.cost}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 block">Bikri Rate</span>
                        <span class="text-xs font-bold text-slate-900">Rs. ${p.price}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 block">Bachat</span>
                        <span class="text-xs font-bold text-emerald-600">+Rs. ${profit}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center pt-1">
                    <button onclick="addProductToPos(${p.id})"
                        class="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 active:scale-95 transition-transform">
                        <span class="material-symbols-outlined text-[15px]">add_shopping_cart</span> Bill Mein Daalein
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

    if (!name) return showToast('Bara-e-meherbani cheez ka naam likhein');

    // Generate auto aliases for natural language parsing
    const aliases = [name.toLowerCase(), name.toLowerCase().split(' ')[0]];

    state.products.unshift({ 
        id: Date.now(), 
        name, 
        aliases, 
        category: cat, 
        unit, 
        cost, 
        price: sell, 
        stock, 
        minStock: 5 
    });

    closeModal('modal-new-product');
    persistDB();
    renderAll();
    showToast(`${name} godown database mein darj ho gaya!`);
}

function simulateBarcodeScan(context) {
    const rnd = state.products[Math.floor(Math.random() * state.products.length)];
    if (context === 'pos') {
        addProductToPos(rnd.id);
    } else {
        document.getElementById('stock-search').value = rnd.name.split(' ')[0];
        renderStock();
        showToast(`Barcode Scan Ho Gaya: ${rnd.name}`);
    }
}
