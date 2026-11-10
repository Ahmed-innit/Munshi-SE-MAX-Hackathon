/* ============================================================
   Munshi AI — Voice AI & Home View (Compliant with Module D)
   Connected to MunshiParser & Supabase Sync Engine
   ============================================================ */

function toggleVoiceRecording() {
    state.isRecording = !state.isRecording;
    const btn   = document.getElementById('home-mic-btn');
    const title = document.getElementById('voice-status-title');
    const sub   = document.getElementById('voice-status-sub');

    if (state.isRecording) {
        btn.classList.add('mic-pulse', 'bg-red-600');
        btn.classList.remove('bg-slate-900');
        title.innerText = 'Listening... Speak now';
        sub.innerText   = 'Bol kar hisaab likhwaein...';

        // Auto-simulate sample voice input after 2.2s
        setTimeout(() => {
            if (!state.isRecording) return;
            toggleVoiceRecording();
            const samples = [
                'Ali ko 2 kg chawal udhaar par diya',
                'Ali ne 500 diya',
                'Aata 20 kilo aya hai, 150 rupay kilo',
                'Chawal 5 kg becha, 300 rupay kilo'
            ];
            document.getElementById('ai-command-input').value =
                samples[Math.floor(Math.random() * samples.length)];
            processAICommand();
        }, 2200);
    } else {
        btn.classList.remove('mic-pulse', 'bg-red-600');
        btn.classList.add('bg-slate-900');
        title.innerText = 'Tap to speak in Urdu';
        sub.innerText   = '"Ali ko 2 kg chawal udhaar par diya" or "Ali ne 500 diya"';
    }
}

function prefillAICommand(cmd) {
    document.getElementById('ai-command-input').value = cmd;
    processAICommand();
}

function processAICommand() {
    const input = document.getElementById('ai-command-input');
    const text  = input.value.trim();
    if (!text) return;

    if (!window.MunshiParser) {
        showToast('Parser loading...');
        return;
    }

    const draft = window.MunshiParser.parseCommand(text, state.customers, state.products);

    // 1. QUERY INTENT (TC-PAR-09)
    if (draft.intent === 'QUERY') {
        input.value = '';
        if (draft.customerName) {
            const cust = state.customers.find(c => String(c.id) === String(draft.customerId)) ||
                         state.customers.find(c => c.name.toLowerCase().includes(draft.customerName.toLowerCase()));
            const bal = cust ? cust.balance : 0;
            showToast(`${cust ? cust.name : draft.customerName} ka baqiya udhaar: Rs. ${bal.toLocaleString()}`);
        } else {
            const total = state.customers.reduce((s, c) => s + c.balance, 0);
            showToast(`Kul baqiya udhaar: Rs. ${total.toLocaleString()}`);
        }
        return;
    }

    // 2. REPORT INTENT (TC-PAR-10)
    if (draft.intent === 'REPORT') {
        input.value = '';
        switchTab('reports');
        showToast(`Aaj ki kul bikri: Rs. ${state.cashSalesToday.toLocaleString()}`);
        return;
    }

    // 3. UNKNOWN OR CLARIFYING QUESTION (TC-PAR-07, TC-PAR-20, TC-PAR-22, TC-PAR-23)
    if (draft.intent === 'UNKNOWN' || draft.intent === 'AMBIGUOUS' || draft.clarifyingQuestion) {
        state.pendingAI = {
            draft,
            isQuestion: true,
            questionText: draft.clarifyingQuestion || 'Samajh nahi aya. Dobara likhein ya manual entry karein.',
            candidates: draft.candidateCustomers || [],
            rawText: `"${text}"`
        };
        input.value = '';
        renderPendingAICard();
        return;
    }

    // 4. ACTIONABLE DRAFT (TC-PAR-01 to TC-PAR-06, TC-PAR-25)
    state.pendingAI = {
        draft,
        isQuestion: false,
        intent: draft.intent,
        customerId: draft.customerId,
        customerName: draft.customerName,
        productId: draft.productId,
        productName: draft.productName,
        quantity: draft.quantity || 1,
        quantityBase: draft.quantityBase || 1,
        unit: draft.unit || 'unit',
        unitPrice: draft.unitPricePaisa ? draft.unitPricePaisa / 100 : (draft.totalPaisa ? (draft.totalPaisa / 100) / (draft.quantity || 1) : 100),
        total: draft.totalPaisa ? draft.totalPaisa / 100 : 100,
        paymentMethod: draft.paymentMethod || 'CASH',
        rawText: `"${text}"`
    };

    input.value = '';
    renderPendingAICard();
    showToast('Munshi AI ne hisaab tayyar kiya — Tasdeeq karein');
}

function selectCandidateCustomer(custId, custName) {
    if (!state.pendingAI || !state.pendingAI.draft) return;
    const draft = state.pendingAI.draft;
    draft.customerId = custId;
    draft.customerName = custName;
    draft.clarifyingQuestion = null;
    draft.isAmbiguous = false;
    draft.intent = draft.intent === 'AMBIGUOUS' ? 'SALE_UDHAAR' : draft.intent;

    state.pendingAI = {
        draft,
        isQuestion: false,
        intent: draft.intent,
        customerId: custId,
        customerName: custName,
        productId: draft.productId,
        productName: draft.productName,
        quantity: draft.quantity || 1,
        quantityBase: draft.quantityBase || 1,
        unit: draft.unit || 'unit',
        unitPrice: draft.unitPricePaisa ? draft.unitPricePaisa / 100 : (draft.totalPaisa ? (draft.totalPaisa / 100) / (draft.quantity || 1) : 100),
        total: draft.totalPaisa ? draft.totalPaisa / 100 : 100,
        paymentMethod: 'UDHAAR',
        rawText: draft.rawText
    };
    renderPendingAICard();
}

function renderPendingAICard() {
    const container = document.getElementById('ai-pending-container');
    if (!state.pendingAI) { container.innerHTML = ''; return; }

    const p = state.pendingAI;

    // Render clarifying question / ambiguity resolution
    if (p.isQuestion) {
        const candidateBtns = p.candidates && p.candidates.length > 0
            ? `<div class="flex flex-wrap gap-2 pt-1">
                ${p.candidates.map(c => `
                    <button onclick="selectCandidateCustomer('${c.id}', '${c.name}')"
                        class="bg-white text-slate-900 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-slate-100 active:scale-95 transition-all">
                        ${c.name}
                    </button>
                `).join('')}
               </div>`
            : '';

        container.innerHTML = `
            <div class="bg-amber-950/90 text-amber-100 border border-amber-500/40 rounded-2xl p-5 shadow-lg flex flex-col gap-3 slide-up">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full">
                        Wazahat Darkaar Hai
                    </span>
                    <span class="text-xs text-amber-300/70 italic truncate max-w-[160px]">${p.rawText}</span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-amber-400 text-2xl">help</span>
                    <p class="font-semibold text-sm leading-snug text-white">${p.questionText}</p>
                </div>
                ${candidateBtns}
                <div class="flex justify-end pt-2">
                    <button onclick="dismissPendingAI()" class="text-xs text-amber-300 hover:text-white font-medium py-1 px-3 rounded-lg bg-white/10">
                        Theek hai, dismiss
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Render editable confirmation card (TC-PAR-25, TC-REG-06)
    const isUdhaar = p.intent === 'SALE_UDHAAR';
    const isPayment = p.intent === 'PAYMENT_RECEIVED';
    const isPurchase = p.intent === 'STOCK_PURCHASE';
    const badgeColor = isUdhaar ? 'text-red-400' : (isPayment ? 'text-emerald-400' : 'text-blue-400');
    const badgeLabel = isUdhaar ? 'Naya Udhaar' : (isPayment ? 'Wasooli' : (isPurchase ? 'Stock Khareed' : 'Cash Sale'));

    container.innerHTML = `
        <div class="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col gap-4 slide-up">
            <div class="flex justify-between items-center">
                <span class="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-slate-300 px-2.5 py-1 rounded-full">
                    Tasdeeq Karein (Confirm Entry)
                </span>
                <span class="text-xs text-slate-400 italic truncate max-w-[160px]">${p.rawText}</span>
            </div>

            <div class="space-y-3 bg-white/5 p-3.5 rounded-xl text-xs">
                ${p.customerName ? `
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Customer:</span>
                    <strong class="text-white text-sm">${p.customerName}</strong>
                </div>` : ''}

                ${p.productName ? `
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Maal (Product):</span>
                    <strong class="text-white text-sm">${p.productName}</strong>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-slate-400">Tadaad (Qty):</span>
                    <div class="flex items-center gap-1.5">
                        <input id="edit-draft-qty" type="number" step="0.5" value="${p.quantity}"
                            onchange="onDraftQtyChange(this.value)"
                            class="w-16 bg-white/10 text-white rounded px-2 py-0.5 text-right font-bold focus:outline-none focus:ring-1 focus:ring-white">
                        <span class="text-slate-300">${p.unit}</span>
                    </div>
                </div>` : ''}

                <div class="flex justify-between items-center pt-1 border-t border-white/10">
                    <span class="text-slate-300 font-medium">Kul Raqam (Total):</span>
                    <div class="flex items-center gap-1">
                        <span class="text-slate-400">Rs.</span>
                        <input id="edit-draft-total" type="number" value="${p.total}"
                            class="w-24 bg-white/10 text-white rounded px-2 py-1 text-right font-bold text-base focus:outline-none focus:ring-1 focus:ring-white">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-1">
                <button onclick="confirmPendingAI()"
                    class="col-span-2 bg-white text-slate-900 py-2.5 rounded-xl font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-[16px]">check</span> Tasdeeq Karein (Save)
                </button>
                <button onclick="dismissPendingAI()"
                    class="bg-slate-800 text-slate-300 py-2.5 rounded-xl font-medium text-xs active:scale-95 transition-all">
                    Cancel
                </button>
            </div>
        </div>
    `;
}

function onDraftQtyChange(newQty) {
    if (!state.pendingAI) return;
    const q = parseFloat(newQty) || 1;
    state.pendingAI.quantity = q;
    state.pendingAI.quantityBase = Math.round(q * (state.pendingAI.unit === 'kg' || state.pendingAI.unit === 'litre' ? 1000 : 1));
    state.pendingAI.total = Math.round(q * state.pendingAI.unitPrice);
    const totalInput = document.getElementById('edit-draft-total');
    if (totalInput) totalInput.value = state.pendingAI.total;
}

async function confirmPendingAI() {
    if (!state.pendingAI) return;
    const p = state.pendingAI;

    // Read edited total from input if modified by user
    const totalEl = document.getElementById('edit-draft-total');
    const finalTotal = totalEl ? (parseFloat(totalEl.value) || p.total) : p.total;
    const qtyEl = document.getElementById('edit-draft-qty');
    const finalQty = qtyEl ? (parseFloat(qtyEl.value) || p.quantity) : p.quantity;

    const cust = state.customers.find(x => String(x.id) === String(p.customerId));
    const prod = state.products.find(x => String(x.id) === String(p.productId)) ||
                 state.products.find(x => p.productName && x.name.toLowerCase().includes(p.productName.toLowerCase())) ||
                 state.products[0];

    const amountPaisa = Math.round(finalTotal * 100);
    const unitPricePaisa = Math.round((finalTotal / (finalQty || 1)) * 100);
    const quantityBase = Math.round((finalQty || 1) * (p.unit === 'kg' || p.unit === 'litre' ? 1000 : 1));

    if (p.intent === 'PAYMENT_RECEIVED') {
        state.wasooliToday += finalTotal;
        if (cust) cust.balance = Math.max(0, cust.balance - finalTotal);
        state.transactions.unshift({
            id: window.api ? api.newId() : Date.now(),
            title: cust ? cust.name : 'Customer',
            subtitle: 'Voice AI Wasooli • Just now',
            amount: finalTotal,
            type: 'wasooli'
        });

        if (window.api && cust) {
            await api.syncOperation('PAYMENT_RECEIVED', {
                id: api.newId(),
                customerId: String(cust.id),
                amountPaisa: amountPaisa,
                note: 'Voice AI Wasooli'
            });
            await api.loadBalances();
        }
    } else if (p.intent === 'STOCK_PURCHASE') {
        if (prod) prod.stock += finalQty;
        state.transactions.unshift({
            id: window.api ? api.newId() : Date.now(),
            title: prod ? prod.name : 'Stock Purchase',
            subtitle: `Stock In • +${finalQty} ${p.unit || 'units'}`,
            amount: finalTotal,
            type: 'sale'
        });

        if (window.api && prod) {
            await api.syncOperation('STOCK_PURCHASE', {
                id: api.newId(),
                productId: String(prod.id),
                quantityBase: quantityBase,
                unitCostPaisa: unitPricePaisa,
                reason: 'Stock purchase via Munshi AI'
            });
            await api.loadStock();
        }
    } else if (p.intent === 'RETURN_ENTRY') {
        if (prod) prod.stock += finalQty;
        if (cust) cust.balance = Math.max(0, cust.balance - finalTotal);
        state.transactions.unshift({
            id: window.api ? api.newId() : Date.now(),
            title: `${cust ? cust.name : 'Customer'} — Return`,
            subtitle: `Return • ${prod ? prod.name : 'Maal'}`,
            amount: finalTotal,
            type: 'wasooli'
        });

        if (window.api) {
            await api.syncOperation('RETURN_ENTRY', {
                customerId: cust ? String(cust.id) : null,
                productId: prod ? String(prod.id) : null,
                quantityBase: quantityBase,
                amountPaisa: amountPaisa,
                reason: 'Customer return'
            });
            await api.loadStock();
            await api.loadBalances();
        }
    } else {
        // SALE_UDHAAR or SALE_CASH
        const isUdhaar = p.intent === 'SALE_UDHAAR';
        if (isUdhaar) {
            state.nayaUdhaarToday += finalTotal;
            if (cust) cust.balance += finalTotal;
            state.transactions.unshift({
                id: window.api ? api.newId() : Date.now(),
                title: `${cust ? cust.name : 'Customer'} — ${prod ? prod.name.split('(')[0] : 'Kiryana'}`,
                subtitle: 'Voice AI Udhaar • Just now',
                amount: finalTotal,
                type: 'udhaar'
            });
        } else {
            state.cashSalesToday += finalTotal;
            if (prod) prod.stock = Math.max(0, prod.stock - finalQty);
            state.transactions.unshift({
                id: window.api ? api.newId() : Date.now(),
                title: prod ? prod.name : 'Naqad Bikri',
                subtitle: 'Voice AI Cash Sale • Just now',
                amount: finalTotal,
                type: 'sale'
            });
        }

        if (window.api && prod) {
            const res = await api.syncOperation(isUdhaar ? 'SALE_UDHAAR' : 'SALE_CASH', {
                id: api.newId(),
                customerId: isUdhaar && cust ? String(cust.id) : null,
                lines: [{
                    productId: String(prod.id),
                    quantityBase: quantityBase,
                    unitPricePaisa: unitPricePaisa,
                    totalPaisa: amountPaisa,
                    productName: prod.name
                }],
                totalPaisa: amountPaisa,
                paymentMethod: isUdhaar ? 'UDHAAR' : 'CASH',
                createdAt: new Date().toISOString()
            });

            if (res.data && res.data.code === 'NEGATIVE_STOCK') {
                showToast(`Stock rukawat: ${prod.name} godown mein mojood nahi!`);
                return;
            }
            await api.loadStock();
            await api.loadBalances();
        }
    }

    state.pendingAI = null;
    renderAll();
    showToast('Saved to Khata & Godown Ledger!');
}

function dismissPendingAI() {
    state.pendingAI = null;
    renderPendingAICard();
}

function setHomeTxFilter(filter) {
    state.homeTxFilter = filter;
    document.querySelectorAll('.home-filter-pill').forEach(btn => {
        btn.className = btn.dataset.filter === filter
            ? 'home-filter-pill text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900 text-white'
            : 'home-filter-pill text-[11px] font-medium px-2.5 py-1 rounded-full text-slate-500 hover:text-slate-900';
    });
    renderHomeTransactions();
}

function renderHomeTransactions() {
    const list     = document.getElementById('home-tx-list');
    const filtered = state.transactions.filter(t =>
        state.homeTxFilter === 'all' || t.type === state.homeTxFilter
    );

    list.innerHTML = filtered.slice(0, 6).map(t => {
        const isUdhaar = t.type === 'udhaar';
        const icon     = t.type === 'sale' ? 'shopping_basket' : (t.type === 'wasooli' ? 'account_balance' : 'edit_note');
        const amtColor = isUdhaar ? 'text-red-500' : 'text-slate-900';
        const sign     = isUdhaar ? '-' : '+';
        return `
            <div class="soft-card p-3.5 rounded-2xl flex justify-between items-center slide-up">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                        <span class="material-symbols-outlined text-[20px]">${icon}</span>
                    </div>
                    <div class="min-w-0">
                        <p class="font-semibold text-sm text-slate-900 truncate">${t.title}</p>
                        <p class="text-xs text-slate-400 truncate">${t.subtitle}</p>
                    </div>
                </div>
                <p class="font-semibold text-sm ${amtColor} shrink-0 pl-2">${sign}Rs. ${t.amount.toLocaleString()}</p>
            </div>
        `;
    }).join('');
}

function goToLowStock() {
    switchTab('stock');
    setStockCategory('low');
}
