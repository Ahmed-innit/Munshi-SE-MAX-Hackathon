/* ============================================================
   Munshi AI — Udhaar Khata Register (Roman Urdu)
   Connected with Database Persistence
   ============================================================ */

function setUdhaarFilter(f) {
    state.udhaarFilter = f;
    document.querySelectorAll('.udhaar-filter-btn').forEach(btn => {
        btn.className = btn.dataset.filter === f
            ? 'udhaar-filter-btn px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900 text-white'
            : 'udhaar-filter-btn px-4 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600';
    });
    renderUdhaarList();
}

function renderUdhaarList() {
    const totalUdhaar = state.customers.reduce((s, c) => s + c.balance, 0);
    const overdueSum  = state.customers.filter(c => c.overdueDays > 0).reduce((s, c) => s + c.balance, 0);

    const totEl = document.getElementById('udhaar-total-val');
    const actEl = document.getElementById('udhaar-active-count');
    const wasEl = document.getElementById('udhaar-today-wasooli');
    const ovrEl = document.getElementById('udhaar-overdue-val');
    const listEl = document.getElementById('udhaar-customer-list');

    if (totEl) totEl.innerText     = `Rs. ${totalUdhaar.toLocaleString()}`;
    if (actEl) actEl.innerText  = `Kul ${state.customers.length} grahakon kay khatay active hain`;
    if (wasEl) wasEl.innerText = `Rs. ${state.wasooliToday.toLocaleString()}`;
    if (ovrEl) ovrEl.innerText   = `Rs. ${overdueSum.toLocaleString()}`;

    if (!listEl) return;

    const q = (document.getElementById('udhaar-search')?.value || '').toLowerCase();
    const filtered = state.customers.filter(c => {
        const matchQ = c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.role.toLowerCase().includes(q);
        if (!matchQ) return false;
        if (state.udhaarFilter === 'overdue') return c.overdueDays > 0;
        if (state.udhaarFilter === 'high')    return c.balance >= 10000;
        return true;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="soft-card p-6 rounded-2xl text-center space-y-2">
                <span class="material-symbols-outlined text-amber-500 text-3xl">person_search</span>
                <p class="font-bold text-sm text-slate-800">Database Mein Aesa Koi Grahak Nahi Hai</p>
                <p class="text-xs text-slate-500">Aap naya khata khol saktay hain ya search tabdeel karein.</p>
                <button onclick="openNewCustomerModal()" class="mt-2 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl">
                    + Naya Grahak Khata Kholein
                </button>
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(c => {
        const initials  = c.name.split(' ').map(w => w[0]).join('').slice(0, 2);
        const isOverdue = c.overdueDays > 0;
        const pct       = Math.min(100, Math.round((c.balance / c.limit) * 100));

        return `
            <div class="soft-card p-5 rounded-2xl space-y-4 relative overflow-hidden ${isOverdue ? 'border-red-100' : ''} slide-up">
                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">${initials}</div>
                        <div>
                            <h4 class="font-semibold text-sm text-slate-900">${c.name}</h4>
                            <p class="text-xs text-slate-400 mt-0.5">${c.role} • ${isOverdue
                                ? `<span class="text-red-500 font-medium">${c.overdueDays} Din Purana</span>`
                                : 'Pakka Grahak'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-[10px] text-slate-400 block">Kul Baqiya</span>
                        <span class="text-base font-bold ${isOverdue ? 'text-red-600' : 'text-slate-900'}">
                            Rs. ${c.balance.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Udhaar Had: Rs. ${c.limit.toLocaleString()}</span>
                        <span>${pct}% Istemaal</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="${pct > 80 ? 'bg-amber-500' : 'bg-slate-900'} h-full rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2.5 pt-1">
                    <button onclick="openWasooliModal(${c.id})"
                        class="py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <span class="material-symbols-outlined text-[16px]">payments</span> Wasooli Likhein
                    </button>
                    <button onclick="openCustomerDetailModal(${c.id})"
                        class="py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
                        <span class="material-symbols-outlined text-[16px]">chat</span> Paigham Bhejein
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openWasooliModal(defaultCustId) {
    const sel = document.getElementById('wasooli-customer-select');
    if (!sel) return;
    sel.innerHTML = state.customers.map(c =>
        `<option value="${c.id}" ${c.id === defaultCustId ? 'selected' : ''}>${c.name} (Baqiya: Rs. ${c.balance.toLocaleString()})</option>`
    ).join('');
    document.getElementById('wasooli-amount-input').value = '';
    document.getElementById('modal-wasooli').classList.remove('hidden');
    document.getElementById('modal-wasooli').classList.add('flex');
}

function submitWasooli() {
    const custId = parseInt(document.getElementById('wasooli-customer-select').value, 10);
    const amt    = parseFloat(document.getElementById('wasooli-amount-input').value) || 0;
    if (amt <= 0) return showToast('Sahi wasooli raqam darj karein');

    const cust = state.customers.find(c => c.id === custId);
    if (cust) {
        cust.balance       = Math.max(0, cust.balance - amt);
        state.wasooliToday += amt;
        state.transactions.unshift({
            id: Date.now(), title: `${cust.name} (${cust.role})`,
            subtitle: 'Khata Wasooli Mili • Abhi abhi', amount: amt, type: 'wasooli'
        });
    }
    closeModal('modal-wasooli');
    persistDB();
    renderAll();
    showToast(`Rs. ${amt.toLocaleString()} Wasooli darj ho gayi!`);
}

function openNewCustomerModal() {
    document.getElementById('modal-new-customer').classList.remove('hidden');
    document.getElementById('modal-new-customer').classList.add('flex');
}

function submitNewCustomer() {
    const name  = document.getElementById('new-cust-name').value.trim();
    const role  = document.getElementById('new-cust-role').value.trim()  || 'Grahak';
    const phone = document.getElementById('new-cust-phone').value.trim() || '0300-1234567';
    const bal   = parseFloat(document.getElementById('new-cust-bal').value) || 0;

    if (!name) return showToast('Bara-e-meherbani grahak ka naam likhein');

    state.customers.unshift({ id: Date.now(), name, role, phone, balance: bal, limit: 20000, overdueDays: 0 });
    closeModal('modal-new-customer');
    persistDB();
    renderAll();
    showToast(`${name} ka naya khata khul gaya!`);
}

function openCustomerDetailModal(custId) {
    const cust = state.customers.find(c => c.id === custId);
    if (!cust) return;

    document.getElementById('detail-cust-name').innerText  = cust.name;
    document.getElementById('detail-cust-phone').innerText = `${cust.role} • ${cust.phone}`;
    document.getElementById('detail-wa-message').innerText =
        `"Assalam-o-Alaikum ${cust.name} sb! Madina Kiryana Store ki taraf se aapka baqiya Khata hisaab ` +
        `Rs. ${cust.balance.toLocaleString()} hai. Baraye meherbani adaigi farma dein. Shukriya — Haji Tariq."`;

    document.getElementById('modal-customer-detail').classList.remove('hidden');
    document.getElementById('modal-customer-detail').classList.add('flex');
}

function copyReminderText() {
    const msg  = document.getElementById('detail-wa-message').innerText;
    const temp = document.createElement('textarea');
    temp.value = msg;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    showToast('WhatsApp paigham copy ho gaya!');
}

function sendWhatsAppReminder() {
    closeModal('modal-customer-detail');
    showToast('WhatsApp par yaad-dihani paigham bhej diya gaya!');
}
