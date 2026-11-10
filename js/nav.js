/* ============================================================
   Munshi AI — Navigation & Header Controller
   ============================================================ */

function switchTab(tab) {
    state.activeTab = tab;

    // Hide all views
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const activeEl = document.getElementById('view-' + tab);
    if (activeEl) activeEl.classList.remove('hidden');

    // Update header text
    const titles = {
        home:     ['Madina Kiryana',  'Haji Tariq'],
        stock:    ['Godown Inventory','Stock Register'],
        bikri:    ['Counter 01 • POS','New Sale (Bikri)'],
        udhaar:   ['Customer Ledgers','Udhaar Book'],
        packages: ['Telecom Portal',  'Mobile Load'],
        reports:  ['Madina Kiryana',  'Karobari Reports']
    };
    if (titles[tab]) {
        document.getElementById('header-subtitle').innerText = titles[tab][0];
        document.getElementById('header-title').innerText   = titles[tab][1];
    }

    // Update bottom nav icon states
    ['home', 'stock', 'udhaar', 'packages'].forEach(navId => {
        const btn  = document.getElementById('nav-' + navId);
        if (!btn) return;
        const icon = btn.querySelector('.material-symbols-outlined');
        if (navId === tab) {
            btn.classList.replace('text-slate-400', 'text-slate-900');
            icon.classList.add('fill-icon');
        } else {
            btn.classList.add('text-slate-400');
            btn.classList.remove('text-slate-900');
            icon.classList.remove('fill-icon');
        }
    });

    // Reports button in header
    const repBtn = document.getElementById('header-reports-btn');
    repBtn.className = tab === 'reports'
        ? 'w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm transition-all'
        : 'w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-xs transition-all';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderAll();
}

function toggleSyncMode() {
    state.isOnline = !state.isOnline;
    const dot = document.getElementById('sync-dot');
    const txt = document.getElementById('sync-text');
    if (state.isOnline) {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500';
        txt.innerText  = 'Synced';
        showToast('Cloud Sync Active • All entries backed up');
    } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse';
        txt.innerText  = 'Offline Ready';
        showToast('Offline Mode • Saving entries on device');
    }
}

function openProfileModal() {
    showToast('Madina Kiryana Store • G-9 Markaz Islamabad');
}

