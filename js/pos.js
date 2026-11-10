/* ============================================================
   Munshi AI — POS / Bikri (New Sale) View
   ============================================================ */

function setPosCustomerMode(mode) {
    state.posCustomerMode = mode;
    const walkinBtn    = document.getElementById('pos-cust-walkin');
    const khataBtn     = document.getElementById('pos-cust-khata');
    const selectorBox  = document.getElementById('pos-khata-selector-box');

    if (mode === 'walkin') {
        walkinBtn.className = 'py-2 rounded-lg text-xs font-semibold transition-all bg-white text-slate-900 shadow-xs';
        khataBtn.className  = 'py-2 rounded-lg text-xs font-medium text-slate-500 transition-all';
        selectorBox.classList.add('hidden');
        setPosPaymentMode('cash');
    } else {
        khataBtn.className  = 'py-2 rounded-lg text-xs font-semibold transition-all bg-white text-slate-900 shadow-xs';
        walkinBtn.className = 'py-2 rounded-lg text-xs font-medium text-slate-500 transition-all';
        selectorBox.classList.remove('hidden');
        populatePosCustomerDropdown();
        setPosPaymentMode('udhaar');
    }
}

function populatePosCustomerDropdown() {
    const sel     = document.getElementById('pos-customer-select');
    sel.innerHTML = state.customers.map(c =>
        `<option value="${c.id}" ${c.id == state.posCustomerId ? 'selected' : ''}>${c.name} (${c.role})</option>`
    ).join('');
    onPosCustomerChange();
}

function onPosCustomerChange() {
    state.posCustomerId = parseInt(document.getElementById('pos-customer-select').value, 10);
    const cust = state.customers.find(c => c.id === state.posCustomerId);
    if (cust) {
        const initials = cust.name.split(' ').map(w => w[0]).join('').slice(0, 2);
        document.getElementById('pos-cust-initials').innerText    = initials;
        document.getElementById('pos-cust-prev-bal').innerText    = `Rs. ${cust.balance.toLocaleString()}`;
    }
    updatePosContextBanner();
}

function renderPosQuickPills() {
    const q   = (document.getElementById('pos-item-search')?.value || '').toLowerCase();
    const container = document.getElementById('pos-quick-pills');
    const list = state.products.filter(p => p.name.toLowerCase().includes(q));

    container.innerHTML = list.map(p => `
        <button onclick="addProductToPos(${p.id})"
            class="shrink-0 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-full transition-colors">
            + ${p.name.split('(')[0].trim()} (Rs.${p.price})
        </button>
    `).join('');
}

function addProductToPos(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;
    const existing = state.cart.find(c => c.productId === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        state.cart.push({ productId: prod.id, name: prod.name, price: prod.price, qty: 1, unit: prod.unit });
    }
    if (state.activeTab !== 'bikri') switchTab('bikri');
    else renderPosCart();
    showToast(`Added ${prod.name.split('(')[0]} to Bill`);
}

function updatePosCartQty(productId, delta) {
    const item = state.cart.find(c => c.productId === productId);
    if (!item) return;
    item.qty = +(item.qty + delta).toFixed(1);
    if (item.qty <= 0) state.cart = state.cart.filter(c => c.productId !== productId);
    renderPosCart();
}

function clearPosCart() {
    state.cart = [];
    renderPosCart();
}

function getPosTotals() {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
    return { subtotal, discount, net: Math.max(0, Math.round(subtotal - discount)) };
}

function renderPosCart() {
    const list = document.getElementById('pos-cart-list');
    document.getElementById('pos-cart-badge').innerText = `${state.cart.length} Items`;

    list.innerHTML = state.cart.length === 0
        ? `<div class="py-8 text-center text-xs text-slate-400">Cart is empty. Tap any product above to add.</div>`
        : state.cart.map(item => {
            const step = item.unit === 'KG' ? 0.5 : 1;
            return `
                <div class="bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-xs text-slate-900 truncate">${item.name}</p>
                        <p class="text-[11px] text-slate-400">Rs. ${item.price} / ${item.unit}</p>
                    </div>
                    <div class="flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-lg p-0.5 shrink-0">
                        <button onclick="updatePosCartQty(${item.productId}, -${step})" class="w-6 h-6 rounded flex items-center justify-center text-slate-600 active:bg-slate-100">
                            <span class="material-symbols-outlined text-[14px]">remove</span>
                        </button>
                        <span class="text-xs font-bold w-8 text-center">${item.qty}</span>
                        <button onclick="updatePosCartQty(${item.productId}, ${step})" class="w-6 h-6 rounded flex items-center justify-center text-slate-900 active:bg-slate-100">
                            <span class="material-symbols-outlined text-[14px]">add</span>
                        </button>
                    </div>
                    <div class="text-right w-16 shrink-0">
                        <p class="font-bold text-xs text-slate-900">Rs. ${Math.round(item.price * item.qty).toLocaleString()}</p>
                    </div>
                </div>
            `;
        }).join('');

    const { subtotal, net } = getPosTotals();
    document.getElementById('pos-subtotal').innerText    = `Rs. ${Math.round(subtotal).toLocaleString()}`;
    document.getElementById('pos-grand-total').innerText = `Rs. ${net.toLocaleString()}`;
    updatePosContextBanner();
}

function setPosPaymentMode(mode) {
    state.posPaymentMode = mode;
    ['cash', 'udhaar', 'split'].forEach(m => {
        const btn = document.getElementById('pos-pay-' + m);
        btn.className = m === mode
            ? 'py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 bg-slate-900 text-white shadow-xs transition-all'
            : 'py-2.5 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200/60 transition-all';
    });

    const splitBox = document.getElementById('pos-split-box');
    if (mode === 'split') {
        splitBox.classList.remove('hidden');
        if (state.posCustomerMode === 'walkin') setPosCustomerMode('khata');
    } else {
        splitBox.classList.add('hidden');
        if (mode === 'udhaar' && state.posCustomerMode === 'walkin') setPosCustomerMode('khata');
    }
    updatePosContextBanner();
}

function updatePosContextBanner() {
    const banner = document.getElementById('pos-context-banner');
    const { net } = getPosTotals();
    const cust = state.customers.find(c => c.id === state.posCustomerId) || state.customers[0];

    if (state.posPaymentMode === 'cash') {
        banner.innerHTML = `<span class="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
            <span>Rs. ${net.toLocaleString()} will be added to Cash Sales.</span>`;
    } else if (state.posPaymentMode === 'udhaar') {
        const newBal = cust.balance + net;
        banner.innerHTML = `<span class="material-symbols-outlined text-[16px] text-red-500">info</span>
            <span><strong>${cust.name}</strong> new Khata balance: <strong class="text-red-600">Rs. ${newBal.toLocaleString()}</strong></span>`;
    } else {
        const cashPaid   = parseFloat(document.getElementById('pos-split-cash')?.value) || 0;
        const udhaarPart = Math.max(0, net - cashPaid);
        document.getElementById('pos-split-udhaar').innerText = `Rs. ${udhaarPart.toLocaleString()}`;
        const newBal = cust.balance + udhaarPart;
        banner.innerHTML = `<span class="material-symbols-outlined text-[16px] text-amber-600">call_split</span>
            <span>Rs. ${cashPaid} Cash + Rs. ${udhaarPart} to <strong>${cust.name}</strong> (New Bal: Rs. ${newBal.toLocaleString()})</span>`;
    }
}

function completePosSale() {
    if (state.cart.length === 0) return showToast('Please add items to the bill first');
    const { net }  = getPosTotals();
    const cust     = state.customers.find(c => c.id === state.posCustomerId) || state.customers[0];
    const itemSum  = state.cart.map(i => `${i.qty}x ${i.name.split('(')[0].trim()}`).join(', ');

    // Deduct stock
    state.cart.forEach(item => {
        const prod = state.products.find(p => p.id === item.productId);
        if (prod) prod.stock = Math.max(0, +(prod.stock - item.qty).toFixed(1));
    });

    if (state.posPaymentMode === 'cash') {
        state.cashSalesToday += net;
        state.transactions.unshift({ id: Date.now(), title: itemSum, subtitle: 'POS Cash Sale • Just now', amount: net, type: 'sale' });
    } else if (state.posPaymentMode === 'udhaar') {
        state.nayaUdhaarToday += net;
        cust.balance += net;
        state.transactions.unshift({ id: Date.now(), title: `${cust.name} — ${itemSum}`, subtitle: 'POS Udhaar Bill • Just now', amount: net, type: 'udhaar' });
    } else {
        const cashPaid   = Math.min(net, parseFloat(document.getElementById('pos-split-cash')?.value) || 0);
        const udhaarPart = Math.max(0, net - cashPaid);
        state.cashSalesToday  += cashPaid;
        state.nayaUdhaarToday += udhaarPart;
        cust.balance           += udhaarPart;
        state.transactions.unshift({ id: Date.now(), title: `${cust.name} (Split Bill)`, subtitle: `Rs.${cashPaid} Cash + Rs.${udhaarPart} Udhaar`, amount: net, type: 'udhaar' });
    }

    // Show receipt
    document.getElementById('receipt-body').innerHTML = `
        <div class="flex justify-between py-1"><span class="text-slate-400">Customer:</span>
            <span class="font-semibold text-slate-900">${state.posCustomerMode === 'walkin' ? 'Walk-in Cash' : cust.name}</span></div>
        <div class="flex justify-between py-1"><span class="text-slate-400">Items:</span>
            <span class="font-medium text-slate-800">${state.cart.length} Products</span></div>
        <div class="flex justify-between py-1"><span class="text-slate-400">Payment Mode:</span>
            <span class="font-semibold uppercase text-slate-900">${state.posPaymentMode}</span></div>
        <div class="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
            <span>Net Total:</span><span>Rs. ${net.toLocaleString()}</span></div>
    `;
    document.getElementById('modal-receipt').classList.remove('hidden');
    document.getElementById('modal-receipt').classList.add('flex');

    state.cart = [];
    document.getElementById('pos-discount').value = 0;
    renderAll();
}

