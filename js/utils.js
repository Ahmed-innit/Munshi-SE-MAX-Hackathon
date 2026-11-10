/* ============================================================
   Munshi AI — Shared Utilities & Master Render Loop (Roman Urdu)
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

// ---- Master Render ----
function renderAll() {
    // --- Home Rozana Hisaab ---
    const totalKhata = state.customers.reduce((s, c) => s + c.balance, 0);
    document.getElementById('home-kpi-cash').innerText         = `Rs. ${state.cashSalesToday.toLocaleString()}`;
    document.getElementById('home-kpi-wasooli').innerText      = `Rs. ${state.wasooliToday.toLocaleString()}`;
    document.getElementById('home-kpi-udhaar').innerText       = `Rs. ${state.nayaUdhaarToday.toLocaleString()}`;
    document.getElementById('home-kpi-total-khata').innerText  = `Rs. ${totalKhata.toLocaleString()}`;
    document.getElementById('home-kpi-khata-count').innerText  = `${state.customers.length} fa'al khatay`;

    // --- Kam Stock Alert Banner ---
    const lowItems = state.products.filter(p => p.stock <= p.minStock);
    document.getElementById('home-lowstock-title').innerText = `${lowItems.length} Cheezein Khatam Honay Wali Hain`;
    document.getElementById('home-lowstock-sub').innerText   = lowItems.length > 0
        ? lowItems.map(i => i.name.split('(')[0].trim()).join(' aur ') + ' ka stock kam reh gaya hai'
        : 'Godown mein tamam maal pura mojood hai';

    // --- Mukhtalif Safhaat Ka Render ---
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

// ---- Shuruat (Bootstrap) ----
window.onload = function () {
    populatePosCustomerDropdown();
    renderAll();
};
