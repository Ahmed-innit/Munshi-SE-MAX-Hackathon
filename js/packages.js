/* ============================================================
   Munshi AI — Packages / Mobile Load View
   ============================================================ */

function renderPackagesView() {
    document.getElementById('pkg-wallet-balance').innerText = `Rs. ${state.walletBalance.toLocaleString()}`;
    document.getElementById('pkg-kpi-sales').innerText      = `Rs. ${state.loadSalesToday.toLocaleString()}`;
    document.getElementById('pkg-kpi-profit').innerText     = `+Rs. ${state.loadProfitToday.toLocaleString()}`;
    document.getElementById('pkg-kpi-count').innerText      = `${state.loadCountToday} Sent`;

    const networks = [
        { id: 'jazz',    name: 'Jazz',     dot: 'bg-red-500'   },
        { id: 'zong',    name: 'Zong 4G',  dot: 'bg-pink-500'  },
        { id: 'ufone',   name: 'Ufone',    dot: 'bg-orange-500'},
        { id: 'telenor', name: 'Telenor',  dot: 'bg-sky-500'   }
    ];

    document.getElementById('pkg-network-pills').innerHTML = networks.map(n => {
        const active = state.pkgNetwork === n.id;
        return `
            <button onclick="selectPkgNetwork('${n.id}')"
                class="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all
                    ${active ? 'bg-slate-900 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600'}">
                <span class="w-2 h-2 rounded-full ${n.dot}"></span> ${n.name}
            </button>
        `;
    }).join('');

    const bundles = state.telecomPackages[state.pkgNetwork] || [];
    if (!bundles.some(b => b.id === state.pkgSelectedBundleId) && bundles.length > 0) {
        state.pkgSelectedBundleId = bundles[0].id;
    }

    document.getElementById('pkg-bundles-container').innerHTML = bundles.map(b => {
        const isSel = b.id === state.pkgSelectedBundleId;
        return `
            <div onclick="selectBundle('${b.id}')"
                class="rounded-2xl p-3.5 cursor-pointer transition-all relative
                    ${isSel ? 'border-2 border-slate-900 bg-slate-50/70' : 'border border-slate-100 bg-white'}">
                <span class="text-[9px] font-bold px-2 py-0.5 rounded
                    ${isSel ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}">${b.tag}</span>
                <p class="font-bold text-slate-900 text-sm mt-2">${b.name}</p>
                <p class="text-[11px] text-slate-400 mt-0.5">${b.specs}</p>
                <div class="mt-3 flex justify-between items-baseline">
                    <span class="font-bold text-sm text-slate-900">Rs. ${b.price}</span>
                    <span class="text-[10px] font-bold text-emerald-600">+Rs.${b.profit}</span>
                </div>
            </div>
        `;
    }).join('');

    // Populate khata dropdown
    document.getElementById('pkg-khata-select').innerHTML = state.customers.map(c =>
        `<option value="${c.id}">${c.name} (Bal: Rs. ${c.balance})</option>`
    ).join('');

    updatePkgCalculator();
}

function selectPkgNetwork(netId) {
    state.pkgNetwork = netId;
    document.getElementById('pkg-detected-badge').innerText = netId.toUpperCase();
    renderPackagesView();
}

function selectBundle(bundleId) {
    state.pkgSelectedBundleId = bundleId;
    renderPackagesView();
}

function setPkgMode(mode) {
    state.pkgMode = mode;
    const bBtn = document.getElementById('pkg-mode-bundle');
    const dBtn = document.getElementById('pkg-mode-direct');
    const bBox = document.getElementById('pkg-bundles-container');
    const dBox = document.getElementById('pkg-direct-container');

    if (mode === 'bundle') {
        bBtn.className = 'py-2 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-xs transition-all';
        dBtn.className = 'py-2 rounded-lg text-xs font-medium text-slate-500 transition-all';
        bBox.classList.remove('hidden');
        dBox.classList.add('hidden');
    } else {
        dBtn.className = 'py-2 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-xs transition-all';
        bBtn.className = 'py-2 rounded-lg text-xs font-medium text-slate-500 transition-all';
        dBox.classList.remove('hidden');
        bBox.classList.add('hidden');
    }
    updatePkgCalculator();
}

function setDirectLoadAmt(amt) {
    document.getElementById('pkg-direct-amount').value = amt;
    updatePkgCalculator();
}

function onPkgPhoneInput(val) {
    const clean = val.replace(/\D/g, '');
    if      (clean.startsWith('030') || clean.startsWith('032')) selectPkgNetwork('jazz');
    else if (clean.startsWith('031'))                             selectPkgNetwork('zong');
    else if (clean.startsWith('033'))                             selectPkgNetwork('ufone');
    else if (clean.startsWith('034'))                             selectPkgNetwork('telenor');
}

function updatePkgCalculator() {
    let price = 0, profit = 0;
    if (state.pkgMode === 'bundle') {
        const list = state.telecomPackages[state.pkgNetwork] || [];
        const b    = list.find(x => x.id === state.pkgSelectedBundleId) || list[0];
        if (b) { price = b.price; profit = b.profit; }
    } else {
        price  = parseFloat(document.getElementById('pkg-direct-amount')?.value) || 0;
        profit = Math.round(price * 0.08);
    }
    const cost = Math.max(0, price - profit);
    document.getElementById('pkg-calc-price').innerText  = `Rs. ${price.toLocaleString()}`;
    document.getElementById('pkg-calc-cost').innerText   = `Rs. ${cost.toLocaleString()}`;
    document.getElementById('pkg-calc-profit').innerText = `+Rs. ${profit.toLocaleString()}`;
}

function setPkgPayMode(mode) {
    state.pkgPayMode = mode;
    const cashBtn  = document.getElementById('pkg-pay-cash');
    const khataBtn = document.getElementById('pkg-pay-khata');
    const box      = document.getElementById('pkg-khata-customer-box');

    if (mode === 'cash') {
        cashBtn.className  = 'py-2 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-xs';
        khataBtn.className = 'py-2 rounded-lg text-xs font-medium text-slate-500';
        box.classList.add('hidden');
    } else {
        khataBtn.className = 'py-2 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-xs';
        cashBtn.className  = 'py-2 rounded-lg text-xs font-medium text-slate-500';
        box.classList.remove('hidden');
    }
}

function executeMobileLoad() {
    const phone = document.getElementById('pkg-phone-input').value.trim() || '0301-5582910';
    let price = 0, profit = 0, label = '';

    if (state.pkgMode === 'bundle') {
        const list = state.telecomPackages[state.pkgNetwork] || [];
        const b    = list.find(x => x.id === state.pkgSelectedBundleId) || list[0];
        price  = b.price;
        profit = b.profit;
        label  = `${state.pkgNetwork.toUpperCase()} ${b.name}`;
    } else {
        price  = parseFloat(document.getElementById('pkg-direct-amount').value) || 0;
        profit = Math.round(price * 0.08);
        label  = `${state.pkgNetwork.toUpperCase()} Easyload`;
    }

    const cost = price - profit;
    if (cost > state.walletBalance) return showToast('Insufficient Retailer Wallet Balance!');

    state.walletBalance    -= cost;
    state.loadSalesToday   += price;
    state.loadProfitToday  += profit;
    state.loadCountToday   += 1;

    if (state.pkgPayMode === 'cash') {
        state.cashSalesToday += price;
        state.transactions.unshift({
            id: Date.now(), title: `${label} (${phone})`,
            subtitle: `Cash Load • +Rs. ${profit} Profit`, amount: price, type: 'sale'
        });
    } else {
        const custId = document.getElementById('pkg-khata-select').value;
        const cust   = state.customers.find(c => String(c.id) === String(custId));
        if (cust) cust.balance += price;
        state.nayaUdhaarToday += price;
        state.transactions.unshift({
            id: window.api ? api.newId() : Date.now(),
            title: `${cust ? cust.name : phone} — ${label}`,
            subtitle: `Udhaar Load • +Rs. ${profit} Profit`,
            amount: price,
            type: 'udhaar'
        });
    }

    renderAll();
    showToast(`${label} sent to ${phone}! (+Rs.${profit} Profit)`);
}

function topUpWallet() {
    state.walletBalance += 5000;
    renderPackagesView();
    showToast('Rs. 5,000 added to Retailer Wallet');
}

