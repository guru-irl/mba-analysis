/* ═══════════════════════════════════════════════════════════════
   main.js — Entry point
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSliders();
    initToggles();
    fetchLiveFxRate();
    updateCalculations();
});

/**
 * Fetch live USD→INR rate from open.er-api.com (free, no key, CORS-friendly).
 * Updates the fx-rate input and recalculates on success.
 */
function fetchLiveFxRate() {
    const statusEl = document.getElementById('fx-rate-status');
    const fxInput = document.getElementById('fx-rate');

    if (statusEl) statusEl.textContent = '(fetching…)';

    fetch('https://open.er-api.com/v6/latest/USD')
        .then(res => res.json())
        .then(data => {
            if (data.result === 'success' && data.rates && data.rates.INR) {
                const rate = Math.round(data.rates.INR * 100) / 100;
                fxInput.value = rate;
                if (statusEl) statusEl.textContent = '(live)';
                scheduleUpdate();
            } else {
                if (statusEl) statusEl.textContent = '(fallback)';
            }
        })
        .catch(() => {
            if (statusEl) statusEl.textContent = '(offline)';
        });
}
