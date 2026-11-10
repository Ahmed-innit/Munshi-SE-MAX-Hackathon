/* ============================================================
   Munshi AI — Navigation & Header (Roman Urdu)
   ============================================================ */

function switchTab(tab) {
    state.activeTab = tab;

    // Tamam views chupayein
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const activeEl = document.getElementById('view-' + tab);
    if (activeEl) activeEl.classList.remove('hidden');

    // Header unwanat Roman Urdu mein
    const titles = {
        home:     ['Madina Kiryana Store', 'Haji Tariq Sb'],
        stock:    ['Godown Ka Maal',        'Stock Register'],
        bikri:    ['Counter 01 • Naqad',   'Nayi Bikri (Bill)'],
        udhaar:   ['Grahakon Ka Hisaab',   'Udhaar Register'],
        packages: ['Mobile Portal',        'Load Aur Packages'],
        reports:  ['Karobari Jaiza',       'Munafa Aur Reports']
    };
    if (titles[tab]) {
        document.getElementById('header-subtitle').innerText = titles[tab][0];
        document.getElementById('header-title').innerText   = titles[tab][1];
    }

    // Neechay wali patti kay button active karein
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

    // Reports button
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
        txt.innerText  = 'Mahfooz (Online)';
        showToast('Internet Mojood Hai • Data Cloud Par Mahfooz Hai');
    } else {
        dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse';
        txt.innerText  = 'Baghair Internet (Offline)';
        showToast('Offline Mode Shuru • Phone Mein Mahfooz Ho Raha Hai');
    }
}

function openProfileModal() {
    showToast('Madina Kiryana Store • G-9 Markaz Islamabad');
}
