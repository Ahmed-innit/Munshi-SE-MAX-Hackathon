/* ============================================================
   Munshi AI — Shared Utilities & Master Render Loop
   ============================================================ */

// ---- Modal Helpers ----
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); el.classList.remove('flex'); }
}

// ---- Toast Notification ----
let toastTimer = null;
function showToast(msg) {
    const toast = document.getElementById('global-toast');
    document.getElementById('global-toast-text').innerText = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('opacity-100');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 2800);
}

// ---- Master Render (called after every state mutation) ----
function renderAll() {
    // --- Home KPIs ---
    const totalKhata = state.customers.reduce((s, c) => s + c.balance, 0);
    document.getElementById('home-kpi-cash').innerText         = `Rs. ${state.cashSalesToday.toLocaleString()}`;
    document.getElementById('home-kpi-wasooli').innerText      = `Rs. ${state.wasooliToday.toLocaleString()}`;
    document.getElementById('home-kpi-udhaar').innerText       = `Rs. ${state.nayaUdhaarToday.toLocaleString()}`;
    document.getElementById('home-kpi-total-khata').innerText  = `Rs. ${totalKhata.toLocaleString()}`;
    document.getElementById('home-kpi-khata-count').innerText  = `${state.customers.length} active accounts`;

    // --- Low Stock Alert Banner ---
    const lowItems = state.products.filter(p => p.stock <= p.minStock);
    document.getElementById('home-lowstock-title').innerText = `${lowItems.length} Low Stock Alert${lowItems.length !== 1 ? 's' : ''}`;
    document.getElementById('home-lowstock-sub').innerText   = lowItems.length > 0
        ? lowItems.map(i => i.name.split('(')[0].trim()).join(' & ') + ' running low'
        : 'All godown items sufficiently stocked';

    // --- Per-view Renders ---
    renderPendingAICard();
    renderHomeTransactions();
    renderStock();
    renderPosQuickPills();
    renderPosCart();
    renderUdhaarList();
    renderPackagesView();

    // --- Reports live values ---
    const totalRetail = state.products.reduce((s, p) => s + p.price * p.stock, 0);
    document.getElementById('rep-stock').innerText  = `Rs. ${(totalRetail / 1000).toFixed(1)}k`;
    document.getElementById('rep-udhaar').innerText = `Rs. ${(totalKhata   / 1000).toFixed(1)}k`;
}

// ---- Bootstrap ----
window.onload = async function () {
    populatePosCustomerDropdown();
    renderAll();

    if (window.api) {
        try {
            const isOnline = await api.checkHealth();
            if (isOnline) {
                await api.seedIfEmpty();
                await api.loadStock();
                await api.loadBalances();
                renderAll();
                populatePosCustomerDropdown();
            }
        } catch (e) {
            console.warn('Initial backend sync failed:', e);
        }
    }
};

