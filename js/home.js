/* ============================================================
   Munshi AI — Voice AI & Home View
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

        // Auto-simulate voice input after 2.2s
        setTimeout(() => {
            if (!state.isRecording) return;
            toggleVoiceRecording();
            const samples = [
                'Chaudhry Bashir ko 1200 rupay udhaar diya',
                'Bhai Tariq ne 1500 cash wasooli di',
                '3kg Cheeni aur 1 Tapal Tea cash sale'
            ];
            document.getElementById('ai-command-input').value =
                samples[Math.floor(Math.random() * samples.length)];
            processAICommand();
        }, 2200);
    } else {
        btn.classList.remove('mic-pulse', 'bg-red-600');
        btn.classList.add('bg-slate-900');
        title.innerText = 'Tap to speak in Urdu';
        sub.innerText   = '"Bhai Tariq ko 500 udhaar diya" or "2kg cheeni cash sale"';
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

    const lower    = text.toLowerCase();
    const numMatch = text.match(/\d+/g);
    const amount   = numMatch ? parseInt(numMatch[numMatch.length - 1], 10) : 500;

    // Fuzzy customer match
    let matchedCustomer = state.customers.find(c =>
        lower.includes((c.name.split(' ')[1] || c.name).toLowerCase())
    );
    if (!matchedCustomer) matchedCustomer = state.customers[1]; // default: Bhai Tariq

    if (lower.includes('wasool') || lower.includes('diya cash') || lower.includes('wapis')) {
        state.pendingAI = {
            customerId:    matchedCustomer.id,
            customerName:  `${matchedCustomer.name} (${matchedCustomer.role})`,
            amount,
            type:  'wasooli',
            label: 'Wasooli (Payment In)',
            rawText: `"${text}"`
        };
    } else if (lower.includes('udhaar') || lower.includes('khata')) {
        state.pendingAI = {
            customerId:    matchedCustomer.id,
            customerName:  `${matchedCustomer.name} (${matchedCustomer.role})`,
            amount,
            type:  'udhaar',
            label: 'Naya Udhaar',
            rawText: `"${text}"`
        };
    } else {
        state.pendingAI = {
            customerId:   null,
            customerName: text,
            amount:       amount < 100 ? 940 : amount,
            type:  'sale',
            label: 'Cash Sale (Naqad)',
            rawText: `"${text}"`
        };
    }

    input.value = '';
    renderPendingAICard();
    showToast('Munshi AI parsed your voice entry');
}

function renderPendingAICard() {
    const container = document.getElementById('ai-pending-container');
    if (!state.pendingAI) { container.innerHTML = ''; return; }

    const p          = state.pendingAI;
    const badgeColor = p.type === 'udhaar' ? 'text-red-400' : 'text-emerald-400';

    container.innerHTML = `
        <div class="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col gap-4 slide-up">
            <div class="flex justify-between items-center">
                <span class="text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-slate-300 px-2.5 py-1 rounded-full">
                    AI Verification Needed
                </span>
                <span class="text-xs text-slate-400 italic truncate max-w-[160px]">${p.rawText}</span>
            </div>
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3.5">
                    <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-white text-xl">graphic_eq</span>
                    </div>
                    <div>
                        <p class="font-semibold text-base leading-snug">${p.customerName}</p>
                        <p class="text-xs ${badgeColor} font-medium mt-0.5">${p.label}</p>
                    </div>
                </div>
                <p class="text-xl font-bold tracking-tight shrink-0">Rs. ${p.amount.toLocaleString()}</p>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1">
                <button onclick="confirmPendingAI()"
                    class="col-span-2 bg-white text-slate-900 py-2.5 rounded-xl font-semibold text-xs active:scale-95 transition-all flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-[16px]">check</span> Confirm Entry
                </button>
                <button onclick="dismissPendingAI()"
                    class="bg-slate-800 text-slate-300 py-2.5 rounded-xl font-medium text-xs active:scale-95 transition-all">
                    Dismiss
                </button>
            </div>
        </div>
    `;
}

function confirmPendingAI() {
    if (!state.pendingAI) return;
    const p = state.pendingAI;
    const c = state.customers.find(x => x.id === p.customerId);

    if (p.type === 'udhaar') {
        state.nayaUdhaarToday += p.amount;
        if (c) c.balance += p.amount;
        state.transactions.unshift({ id: Date.now(), title: p.customerName, subtitle: 'Voice AI Udhaar • Just now',   amount: p.amount, type: 'udhaar'  });
    } else if (p.type === 'wasooli') {
        state.wasooliToday += p.amount;
        if (c) c.balance = Math.max(0, c.balance - p.amount);
        state.transactions.unshift({ id: Date.now(), title: p.customerName, subtitle: 'Voice AI Wasooli • Just now', amount: p.amount, type: 'wasooli' });
    } else {
        state.cashSalesToday += p.amount;
        state.transactions.unshift({ id: Date.now(), title: p.customerName, subtitle: 'Voice AI Cash Sale • Just now', amount: p.amount, type: 'sale' });
    }

    state.pendingAI = null;
    renderAll();
    showToast('Saved to Khata & Daily Ledger!');
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

