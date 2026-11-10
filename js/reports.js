/* ============================================================
   Munshi AI — Karobari Reports Aur Tajziya (Roman Urdu)
   ============================================================ */

function setReportPeriod(period) {
    document.querySelectorAll('.rep-period-btn').forEach(btn => {
        btn.className = btn.dataset.period === period
            ? 'rep-period-btn flex-1 py-2 rounded-lg text-xs font-semibold bg-white text-slate-900 shadow-xs transition-all'
            : 'rep-period-btn flex-1 py-2 rounded-lg text-xs font-medium text-slate-500 transition-all';
    });

    const scales = {
        today: { sales: `Rs. ${(state.cashSalesToday / 1000).toFixed(1)}k`, profit: 'Rs. 6.2k',  badge: 'Aaj Ka Din'      },
        week:  { sales: 'Rs. 142.8k',                                        profit: 'Rs. 21.4k', badge: 'Is Haftay Ka'   },
        month: { sales: 'Rs. 384.5k',                                        profit: 'Rs. 58.4k', badge: 'Is Mahinay Ka'  },
        year:  { sales: 'Rs. 4.42M',                                         profit: 'Rs. 680k',  badge: 'Is Saal Ka'     }
    };
    const pick = scales[period] || scales.month;
    document.getElementById('rep-sales').innerText        = pick.sales;
    document.getElementById('rep-profit').innerText       = pick.profit;
    document.getElementById('rep-chart-badge').innerText  = pick.badge;
}
