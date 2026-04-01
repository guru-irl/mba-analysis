/* ═══════════════════════════════════════════════════════════════
   ui.js — DOM binding, slider wiring, real-time updates
   ═══════════════════════════════════════════════════════════════ */

/* ── HELPERS ───────────────────────────────────────────────────── */
function $(id) { return document.getElementById(id); }

function formatUSD(val) {
    if (val == null || isNaN(val)) return '—';
    return '$' + Math.round(val).toLocaleString('en-US');
}

function formatINR(val) {
    if (val == null || isNaN(val)) return '—';
    return '₹' + Math.round(val).toLocaleString('en-US');
}

function formatPercent(val, decimals) {
    if (val == null || isNaN(val)) return '—';
    return val.toFixed(decimals !== undefined ? decimals : 2) + '%';
}

function formatMonths(months) {
    if (months == null || months >= 360) return '30+ years';
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y === 0) return m + ' mo';
    if (m === 0) return y + (y === 1 ? ' year' : ' years');
    return y + 'y ' + m + 'mo';
}

/* ── SLIDER SYNC ───────────────────────────────────────────────── */
const SLIDER_PAIRS = [
    ['rent-booth', 'rent-booth-num'],
    ['food-booth', 'food-booth-num'],
    ['rent-kellogg', 'rent-kellogg-num'],
    ['food-kellogg', 'food-kellogg-num'],
    ['us-rate', 'us-rate-num'],
    ['us-term', 'us-term-num'],
    ['india-rate', 'india-rate-num'],
    ['india-term', 'india-term-num'],
    ['india-processing', 'india-processing-num'],
    ['india-forex', 'india-forex-num'],
    ['india-depreciation', 'india-depreciation-num'],
    ['networth-booth', 'networth-booth-num'],
    ['salary-booth', 'salary-booth-num'],
    ['growth-booth', 'growth-booth-num'],
    ['bonus-booth', 'bonus-booth-num'],
    ['signing-booth', 'signing-booth-num'],
    ['intern-booth', 'intern-booth-num'],
    ['stock-booth', 'stock-booth-num'],
    ['living-booth', 'living-booth-num'],
    ['save-booth', 'save-booth-num'],
    ['payoff-yr-booth', 'payoff-yr-booth-num'],
    ['networth-kellogg', 'networth-kellogg-num'],
    ['salary-kellogg', 'salary-kellogg-num'],
    ['growth-kellogg', 'growth-kellogg-num'],
    ['bonus-kellogg', 'bonus-kellogg-num'],
    ['signing-kellogg', 'signing-kellogg-num'],
    ['intern-kellogg', 'intern-kellogg-num'],
    ['stock-kellogg', 'stock-kellogg-num'],
    ['living-kellogg', 'living-kellogg-num'],
    ['save-kellogg', 'save-kellogg-num'],
    ['payoff-yr-kellogg', 'payoff-yr-kellogg-num'],
    ['us-early-payoff', 'us-early-payoff-num'],
    ['india-early-payoff', 'india-early-payoff-num'],
];

function initSliders() {
    for (const [sliderId, numId] of SLIDER_PAIRS) {
        const slider = $(sliderId);
        const num = $(numId);
        if (!slider || !num) continue;

        slider.addEventListener('input', () => {
            num.value = slider.value;
            scheduleUpdate();
        });

        num.addEventListener('input', () => {
            const val = parseFloat(num.value);
            if (!isNaN(val)) {
                slider.value = Math.max(parseFloat(slider.min), Math.min(val, parseFloat(slider.max)));
            }
            scheduleUpdate();
        });
    }

    // Standalone number inputs (no slider pair)
    const standaloneInputs = ['scholarship-booth', 'scholarship-kellogg', 'india-swift', 'fx-rate'];
    for (const id of standaloneInputs) {
        const el = $(id);
        if (el) el.addEventListener('input', scheduleUpdate);
    }
}

/* ── TAB SWITCHING ─────────────────────────────────────────────── */
function switchTab(target) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${target}"]`);
    if (activeBtn) { activeBtn.classList.add('active'); activeBtn.setAttribute('aria-selected', 'true'); }

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const panel = $('tab-' + target);
    if (panel) panel.classList.add('active');

    location.hash = target;

    setTimeout(() => {
        Object.values(chartInstances).forEach(c => { if (c) c.resize(); });
    }, 50);
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Restore tab from URL hash on load
    const hash = location.hash.replace('#', '');
    if (hash && $('tab-' + hash)) {
        switchTab(hash);
    }
}

/* ── TOGGLE BUTTONS ────────────────────────────────────────────── */
let loanYear = '1';            // '1' or '2'
let breakevenProgram = 'booth';
let costCurrency = 'usd';      // 'usd' or 'inr'
let boothLoanSource = 'us';
let kelloggLoanSource = 'us';
let boothLocation = 'illinois';
let kelloggLocation = 'illinois';
let boothBsPeriod = 'monthly';
let kelloggBsPeriod = 'monthly';
let hhBsPeriod = 'monthly';

function initToggleGroup(btnIds, stateSetter) {
    for (const id of btnIds) {
        const el = $(id);
        if (!el) continue;
        el.addEventListener('click', () => {
            btnIds.forEach(bid => $(bid)?.classList.remove('active'));
            el.classList.add('active');
            stateSetter(el);
            scheduleUpdate();
        });
    }
}

function initToggles() {
    // Per-person loan source toggles
    initToggleGroup(['payoff-booth-us', 'payoff-booth-india'], el => {
        boothLoanSource = el.dataset.source;
    });
    initToggleGroup(['payoff-kellogg-us', 'payoff-kellogg-india'], el => {
        kelloggLoanSource = el.dataset.source;
    });
    // Per-person location toggles
    initToggleGroup(['loc-booth-il', 'loc-booth-ny', 'loc-booth-ca'], el => {
        boothLocation = el.dataset.loc;
    });
    initToggleGroup(['loc-kellogg-il', 'loc-kellogg-ny', 'loc-kellogg-ca'], el => {
        kelloggLocation = el.dataset.loc;
    });
    // Balance sheet period toggles
    initToggleGroup(['bs-booth-monthly', 'bs-booth-yearly'], el => {
        boothBsPeriod = el.dataset.period;
    });
    initToggleGroup(['bs-kellogg-monthly', 'bs-kellogg-yearly'], el => {
        kelloggBsPeriod = el.dataset.period;
    });
    initToggleGroup(['bs-hh-monthly', 'bs-hh-yearly'], el => {
        hhBsPeriod = el.dataset.period;
    });
    // Year buttons use their own active class
    for (const id of ['loan-year-1', 'loan-year-2']) {
        $(id).addEventListener('click', () => {
            document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('year-btn--active'));
            $(id).classList.add('year-btn--active');
            loanYear = $(id).dataset.year;
            scheduleUpdate();
        });
    }
    // Program buttons use their own active class
    for (const id of ['breakeven-booth', 'breakeven-kellogg']) {
        $(id).addEventListener('click', () => {
            document.querySelectorAll('.program-btn').forEach(b => b.classList.remove('program-btn--active'));
            $(id).classList.add('program-btn--active');
            breakevenProgram = $(id).dataset.program;
            scheduleUpdate();
        });
    }
    initToggleGroup(['cost-currency-usd', 'cost-currency-inr'], el => {
        costCurrency = el.dataset.currency;
    });

}

/* ── DEBOUNCED UPDATE ──────────────────────────────────────────── */
let updateRAF = null;

function scheduleUpdate() {
    if (updateRAF) cancelAnimationFrame(updateRAF);
    updateRAF = requestAnimationFrame(updateCalculations);
}

/* ── CENTRAL UPDATE FUNCTION ───────────────────────────────────── */
function updateCalculations() {
    // ── Read all inputs ──
    const scholarshipBooth = parseFloat($('scholarship-booth').value) || 0;
    const scholarshipKellogg = parseFloat($('scholarship-kellogg').value) || 0;
    const rentBooth = parseFloat($('rent-booth').value) || 0;
    const foodBooth = parseFloat($('food-booth').value) || 0;
    const rentKellogg = parseFloat($('rent-kellogg').value) || 0;
    const foodKellogg = parseFloat($('food-kellogg').value) || 0;

    const usRate = parseFloat($('us-rate').value) || 0;
    const usTerm = parseInt($('us-term').value) || 10;

    const indiaRate = parseFloat($('india-rate').value) || 0;
    const indiaTerm = parseInt($('india-term').value) || 10;
    const indiaProcessing = parseFloat($('india-processing').value) || 0;
    const indiaForex = parseFloat($('india-forex').value) || 0;
    const indiaSwift = parseFloat($('india-swift').value) || 0;
    const fxRate = parseFloat($('fx-rate').value) || 93;
    const indiaDepreciation = parseFloat($('india-depreciation').value) || 0;

    const usEarlyPayoff = parseInt($('us-early-payoff').value) || 10;
    const indiaEarlyPayoff = parseInt($('india-early-payoff').value) || 10;

    // Tab 2 inputs are read per-person in the Tab 2 section below

    // ── Tuition calculations ──
    const boothTuition = calcNetTuition('booth', scholarshipBooth);
    const kelloggTuition = calcNetTuition('kellogg', scholarshipKellogg);

    $('booth-scholarship-per-period').textContent = formatUSD(boothTuition.scholarshipPerPeriod);
    $('booth-net-tuition').textContent = formatUSD(boothTuition.netTuition);
    $('kellogg-scholarship-per-period').textContent = formatUSD(kelloggTuition.scholarshipPerPeriod);
    $('kellogg-net-tuition').textContent = formatUSD(kelloggTuition.netTuition);

    // ── Living expenses (per program) ──
    const boothLiving = calcLivingExpenses(rentBooth, foodBooth, PROGRAMS.booth.programMonths);
    const kelloggLiving = calcLivingExpenses(rentKellogg, foodKellogg, PROGRAMS.kellogg.programMonths);

    $('booth-living-total').textContent = formatUSD(boothLiving.total);
    $('kellogg-living-total').textContent = formatUSD(kelloggLiving.total);

    // ── Total costs ──
    const totalBooth = calcTotalCost(boothTuition.netTuition, boothLiving.total);
    const totalKellogg = calcTotalCost(kelloggTuition.netTuition, kelloggLiving.total);

    $('total-cost-booth').textContent = formatUSD(totalBooth);
    $('total-cost-kellogg').textContent = formatUSD(totalKellogg);
    $('total-cost-grand').textContent = formatUSD(totalBooth + totalKellogg);
    $('grand-total-booth-mini').textContent = formatUSD(totalBooth);
    $('grand-total-kellogg-mini').textContent = formatUSD(totalKellogg);

    // ── Loan principal based on year selection (always year-specific) ──
    const yr = parseInt(loanYear) || 1;
    // For Year 2, the FX rate at disbursement is already depreciated by 1 year
    const effectiveFxRate = yr === 2 ? fxRate * (1 + indiaDepreciation / 100) : fxRate;
    const boothYr = calcYearCost('booth', yr, scholarshipBooth, rentBooth, foodBooth);
    const kelloggYr = calcYearCost('kellogg', yr, scholarshipKellogg, rentKellogg, foodKellogg);
    const loanBoothPrincipal = boothYr.total;
    const loanKelloggPrincipal = kelloggYr.total;
    const loanBoothQuarters = boothYr.quarters;
    const loanKelloggQuarters = kelloggYr.quarters;

    // Per-year cost cards
    $('year-cost-booth').textContent = formatUSD(loanBoothPrincipal);
    const boothLivingYr = boothYr.months * (rentBooth + foodBooth);
    const kelloggLivingYr = kelloggYr.months * (rentKellogg + foodKellogg);
    $('year-cost-booth-detail').innerHTML = `<strong>${formatUSD(boothYr.tuition)}</strong> tuition + <strong>${formatUSD(boothYr.fees)}</strong> fees + <strong>${formatUSD(boothLivingYr)}</strong> living (${boothYr.months}mo)`;
    $('year-cost-kellogg').textContent = formatUSD(loanKelloggPrincipal);
    $('year-cost-kellogg-detail').innerHTML = `<strong>${formatUSD(kelloggYr.tuition)}</strong> tuition + <strong>${formatUSD(kelloggYr.fees)}</strong> fees + <strong>${formatUSD(kelloggLivingYr)}</strong> living (${kelloggYr.months}mo)`;
    $('year-cost-grand').textContent = formatUSD(loanBoothPrincipal + loanKelloggPrincipal);
    $('year-cost-grand-detail').innerHTML =
        `<strong>${formatUSD(boothYr.tuition + kelloggYr.tuition)}</strong> tuition + <strong>${formatUSD(boothYr.fees + kelloggYr.fees)}</strong> fees + <strong>${formatUSD(boothLivingYr + kelloggLivingYr)}</strong> living`;

    const noteEl = $('loan-year-note');
    const fxNote = yr === 2 ? `FX rate: ₹${effectiveFxRate.toFixed(1)} (₹${fxRate} + ${indiaDepreciation}% Y1 depreciation)` : '';
    if (noteEl) noteEl.textContent = fxNote;

    // ── US Loan ──
    const usBoothLoan = calcUSLoan(loanBoothPrincipal, usRate, usTerm);
    const usKelloggLoan = calcUSLoan(loanKelloggPrincipal, usRate, usTerm);

    const usBoothINR = calcUSLoanINREquivalent(usBoothLoan, effectiveFxRate, indiaDepreciation);
    const usKelloggINR = calcUSLoanINREquivalent(usKelloggLoan, effectiveFxRate, indiaDepreciation);

    $('us-booth-monthly').textContent = formatUSD(usBoothLoan.monthlyPayment);
    $('us-booth-total-interest').textContent = formatUSD(usBoothLoan.totalInterest);
    $('us-booth-total-interest-inr').textContent = formatINR(usBoothINR.totalInterestINR);
    $('us-booth-total-cost').textContent = formatUSD(usBoothLoan.totalPaid);
    $('us-booth-total-cost-inr').textContent = formatINR(usBoothINR.totalPaidINR);
    $('us-kellogg-monthly').textContent = formatUSD(usKelloggLoan.monthlyPayment);
    $('us-kellogg-total-interest').textContent = formatUSD(usKelloggLoan.totalInterest);
    $('us-kellogg-total-interest-inr').textContent = formatINR(usKelloggINR.totalInterestINR);
    $('us-kellogg-total-cost').textContent = formatUSD(usKelloggLoan.totalPaid);
    $('us-kellogg-total-cost-inr').textContent = formatINR(usKelloggINR.totalPaidINR);

    // ── Indian Loan ──
    const indiaParams = {
        processingFee: indiaProcessing,
        forexMarkup: indiaForex,
        swiftFee: indiaSwift,
        fxRate: effectiveFxRate,
        depreciation: indiaDepreciation,
    };

    const indiaBoothLoan = calcIndianLoan(loanBoothPrincipal, indiaRate, indiaTerm, {
        ...indiaParams, quarters: loanBoothQuarters,
    });
    const indiaKelloggLoan = calcIndianLoan(loanKelloggPrincipal, indiaRate, indiaTerm, {
        ...indiaParams, quarters: loanKelloggQuarters,
    });

    $('india-booth-emi').textContent = formatINR(indiaBoothLoan.emiINR);
    $('india-booth-interest-usd').textContent = formatUSD(indiaBoothLoan.totalInterestUSD);
    $('india-booth-interest-inr').textContent = formatINR(indiaBoothLoan.totalInterestINR);
    $('india-booth-effective-total').textContent = formatUSD(indiaBoothLoan.effectiveTotalUSD);
    $('india-booth-total-inr').textContent = formatINR(indiaBoothLoan.totalRepaymentINR);
    $('india-booth-processing-cost').textContent = formatINR(indiaBoothLoan.processingFeeINR);
    $('india-booth-forex-cost').textContent = formatUSD(indiaBoothLoan.disbursementCostUSD);
    $('india-booth-tcs-cost').textContent = formatINR(indiaBoothLoan.tcsAmount);

    $('india-kellogg-emi').textContent = formatINR(indiaKelloggLoan.emiINR);
    $('india-kellogg-interest-usd').textContent = formatUSD(indiaKelloggLoan.totalInterestUSD);
    $('india-kellogg-interest-inr').textContent = formatINR(indiaKelloggLoan.totalInterestINR);
    $('india-kellogg-effective-total').textContent = formatUSD(indiaKelloggLoan.effectiveTotalUSD);
    $('india-kellogg-total-inr').textContent = formatINR(indiaKelloggLoan.totalRepaymentINR);
    $('india-kellogg-processing-cost').textContent = formatINR(indiaKelloggLoan.processingFeeINR);
    $('india-kellogg-forex-cost').textContent = formatUSD(indiaKelloggLoan.disbursementCostUSD);
    $('india-kellogg-tcs-cost').textContent = formatINR(indiaKelloggLoan.tcsAmount);

    // ── Breakeven Chart (uses same year selection as loan section) ──
    const breakevenPrincipal = breakevenProgram === 'booth' ? loanBoothPrincipal : loanKelloggPrincipal;
    const breakevenQuarters = breakevenProgram === 'booth' ? loanBoothQuarters : loanKelloggQuarters;
    const depRates = [
        Math.max(indiaDepreciation - 1.5, -2),
        indiaDepreciation,
        Math.min(indiaDepreciation + 1.5, 10),
    ];

    const breakevenIndiaParams = { ...indiaParams, quarters: breakevenQuarters, term: indiaTerm };
    const breakevenData = calcBreakevenChartData(
        breakevenPrincipal, usRate, usTerm,
        breakevenIndiaParams, depRates, usEarlyPayoff, indiaEarlyPayoff
    );
    createBreakevenChart('breakeven-chart', breakevenData);

    // Breakeven text
    const breakevenResult = calcBreakevenRate(
        breakevenPrincipal, usRate, usTerm,
        breakevenIndiaParams, usEarlyPayoff, indiaEarlyPayoff
    );
    const progLabel = breakevenProgram === 'booth' ? 'Booth' : 'Kellogg';
    const yearLabel = `Year ${yr}`;
    const rateEl = $('breakeven-result-rate');
    const labelEl = $('breakeven-result-label');
    const detailEl = $('breakeven-result-detail');
    const tagsEl = $('breakeven-result-tags');

    if (breakevenResult.rate !== null) {
        labelEl.textContent = `${progLabel} ${yearLabel} — Breakeven Indian Loan Rate`;
        rateEl.textContent = breakevenResult.rate.toFixed(2) + '%';
        detailEl.innerHTML =
            `An Indian bank loan is <strong>cheaper</strong> than the US loan when the Indian rate is below this threshold. ` +
            `Above this rate, the US loan wins.`;
        // Tags
        let tagsHTML =
            `<span class="breakeven-tag">Principal: ${formatUSD(breakevenPrincipal)}</span>` +
            `<span class="breakeven-tag">US APR: ${usRate}%</span>` +
            `<span class="breakeven-tag">INR dep: ${indiaDepreciation}%/yr</span>`;
        if (usEarlyPayoff < usTerm) tagsHTML += `<span class="breakeven-tag">US payoff: ${usEarlyPayoff}yr</span>`;
        if (indiaEarlyPayoff < indiaTerm) tagsHTML += `<span class="breakeven-tag">India payoff: ${indiaEarlyPayoff}yr</span>`;
        tagsEl.innerHTML = tagsHTML;
    } else {
        labelEl.textContent = `${progLabel} ${yearLabel}`;
        rateEl.textContent = 'N/A';
        detailEl.textContent = breakevenResult.message;
        tagsEl.innerHTML =
            `<span class="breakeven-tag">Principal: ${formatUSD(breakevenPrincipal)}</span>` +
            `<span class="breakeven-tag">US APR: ${usRate}%</span>`;
    }

    // ── Cost Comparison Bar Chart (early-payoff & depreciation aware) ──
    // US total costs with early payoff
    const usBoothTotal = calcUSLoanTotalCost(loanBoothPrincipal, usRate, usTerm, usEarlyPayoff);
    const usKelloggTotal = calcUSLoanTotalCost(loanKelloggPrincipal, usRate, usTerm, usEarlyPayoff);
    const usBoothInterest = usBoothTotal - loanBoothPrincipal;
    const usKelloggInterest = usKelloggTotal - loanKelloggPrincipal;

    // Indian total costs with early payoff (USD-equivalent, accounts for depreciation)
    const indiaBoothTotal = calcIndianLoanTotalCostUSD(loanBoothPrincipal, indiaRate, indiaTerm, indiaEarlyPayoff, {
        ...indiaParams, quarters: loanBoothQuarters,
    });
    const indiaKelloggTotal = calcIndianLoanTotalCostUSD(loanKelloggPrincipal, indiaRate, indiaTerm, indiaEarlyPayoff, {
        ...indiaParams, quarters: loanKelloggQuarters,
    });
    const indiaBoothFees = indiaBoothLoan.disbursementCostUSD + indiaBoothLoan.tcsUSD;
    const indiaKelloggFees = indiaKelloggLoan.disbursementCostUSD + indiaKelloggLoan.tcsUSD;
    const indiaBoothInterest = Math.max(indiaBoothTotal - loanBoothPrincipal - indiaBoothFees, 0);
    const indiaKelloggInterest = Math.max(indiaKelloggTotal - loanKelloggPrincipal - indiaKelloggFees, 0);

    const cx = costCurrency === 'inr' ? fxRate : 1;
    createCostComparisonChart('cost-comparison-chart', {
        principal: [loanBoothPrincipal * cx, loanBoothPrincipal * cx, loanKelloggPrincipal * cx, loanKelloggPrincipal * cx],
        interest: [usBoothInterest * cx, indiaBoothInterest * cx, usKelloggInterest * cx, indiaKelloggInterest * cx],
        fees: [0, indiaBoothFees * cx, 0, indiaKelloggFees * cx],
        currency: costCurrency,
        fxRate: fxRate,
    });

    // ── FX History (create once, recreated when live rate arrives) ──
    if (!chartInstances.fxHistory) {
        createFxHistoryChart('fx-history-chart', liveFxRate);
    }

    // ── Tab 2: Dual-Person Payoff Analysis ──
    function computePerson(prefix, programKey, loanSource, loc) {
        const salary = parseFloat($(prefix === 'booth' ? 'salary-booth' : 'salary-kellogg').value) || 0;
        const growth = parseFloat($(prefix === 'booth' ? 'growth-booth' : 'growth-kellogg').value) || 0;
        const bonus = parseFloat($(prefix === 'booth' ? 'bonus-booth' : 'bonus-kellogg').value) || 0;
        const signing = parseFloat($(prefix === 'booth' ? 'signing-booth' : 'signing-kellogg').value) || 0;
        const annualStock = parseFloat($(prefix === 'booth' ? 'stock-booth' : 'stock-kellogg').value) || 0;
        const internStipend = parseFloat($(prefix === 'booth' ? 'intern-booth' : 'intern-kellogg').value) || 0;
        const rawNetWorth = parseFloat($(prefix === 'booth' ? 'networth-booth' : 'networth-kellogg').value) || 0;
        // Internship stipend is earned during MBA — adds to starting net worth
        const startingNetWorth = rawNetWorth + internStipend;
        const living = parseFloat($(prefix === 'booth' ? 'living-booth' : 'living-kellogg').value) || 0;
        const saveRate = parseFloat($(prefix === 'booth' ? 'save-booth' : 'save-kellogg').value) || 0;
        const payoffYr = parseInt($(prefix === 'booth' ? 'payoff-yr-booth' : 'payoff-yr-kellogg').value) || 10;

        const principal = programKey === 'booth' ? totalBooth : totalKellogg;
        const rate = loanSource === 'us' ? usRate : indiaRate;
        const term = loanSource === 'us' ? usTerm : indiaTerm;
        const isIndian = loanSource === 'india';

        // Loan summary — show capitalized balance (includes 2yr in-school interest)
        const monthlyLoanRate = rate / 100 / 12;
        const capitalizedBalance = principal * Math.pow(1 + monthlyLoanRate, 24);
        $('p2-' + prefix + '-principal').textContent = formatUSD(capitalizedBalance);
        $('p2-' + prefix + '-rate').textContent = rate + '%';

        // Bonus dollar display
        const annualBonus = salary * (bonus / 100);
        $('bonus-' + prefix + '-dollar').textContent = formatUSD(annualBonus);

        // Monthly: base salary only (no bonus, no signing, no stock)
        const monthlyTax = calcPostTax(salary, 'single', loc);
        // Yearly: salary + bonus + signing + stock (all taxable)
        const yearlyComp = salary + annualBonus + signing + annualStock;
        const yearlyTax = calcPostTax(yearlyComp, 'single', loc);

        const required = calcMonthlyPayment(capitalizedBalance, rate, payoffYr);
        const monthlySav = Math.max((monthlyTax.netMonthly - living) * (saveRate / 100), 0);
        const disposableMonthly = monthlyTax.netMonthly - living - monthlySav - required;

        const yearlySav = Math.max((yearlyTax.netAnnual - living * 12) * (saveRate / 100), 0);
        const disposableYearly = yearlyTax.netAnnual - living * 12 - yearlySav - required * 12;

        // Balance sheet
        const bsPeriod = prefix === 'booth' ? boothBsPeriod : kelloggBsPeriod;
        const isYearly = bsPeriod === 'yearly';
        const stateLabel = LOCATIONS.find(l => l.key === loc)?.state || 'IL';
        const p = 'p2-' + prefix;

        // Show/hide yearly-only breakdown rows
        $(p + '-row-bonus').style.display = isYearly ? '' : 'none';
        $(p + '-row-signing').style.display = isYearly && signing > 0 ? '' : 'none';
        $(p + '-row-stock').style.display = isYearly && annualStock > 0 ? '' : 'none';

        if (isYearly) {
            $(p + '-bs-base').textContent = formatUSD(salary);
            $(p + '-bs-bonus').textContent = formatUSD(annualBonus);
            $(p + '-bs-signing').textContent = formatUSD(signing);
            $(p + '-bs-stock').textContent = formatUSD(annualStock);
            $(p + '-pretax').textContent = formatUSD(yearlyComp);
            $(p + '-federal').textContent = '-' + formatUSD(yearlyTax.federal);
            $(p + '-state').textContent = '-' + formatUSD(yearlyTax.state);
            $(p + '-fica').textContent = '-' + formatUSD(yearlyTax.fica);
            $(p + '-net-monthly').textContent = formatUSD(yearlyTax.netAnnual);
            $(p + '-bs-living').textContent = '-' + formatUSD(living * 12);
            $(p + '-bs-savings').textContent = '-' + formatUSD(yearlySav);
            $(p + '-bs-payment').textContent = '-' + formatUSD(required * 12);
            const dispEl = $(p + '-disposable');
            dispEl.textContent = formatUSD(disposableYearly);
            dispEl.style.color = disposableYearly >= 0 ? 'var(--positive)' : 'var(--negative)';
        } else {
            $(p + '-bs-base').textContent = formatUSD(salary / 12);
            $(p + '-pretax').textContent = formatUSD(salary / 12);
            $(p + '-federal').textContent = '-' + formatUSD(monthlyTax.federal / 12);
            $(p + '-state').textContent = '-' + formatUSD(monthlyTax.state / 12);
            $(p + '-fica').textContent = '-' + formatUSD(monthlyTax.fica / 12);
            $(p + '-net-monthly').textContent = formatUSD(monthlyTax.netMonthly);
            $(p + '-bs-living').textContent = '-' + formatUSD(living);
            $(p + '-bs-savings').textContent = '-' + formatUSD(monthlySav);
            $(p + '-bs-payment').textContent = '-' + formatUSD(required);
            const dispEl = $(p + '-disposable');
            dispEl.textContent = formatUSD(disposableMonthly);
            dispEl.style.color = disposableMonthly >= 0 ? 'var(--positive)' : 'var(--negative)';
        }

        $(p + '-state-label').textContent = stateLabel;
        $(p + '-save-pct').textContent = saveRate;
        $(p + '-payment').textContent = formatUSD(required);

        // Payoff simulation
        const result = calcPayoffTimeline({
            loanBalance: principal,
            annualLoanRate: rate,
            salary,
            salaryGrowth: growth,
            monthlyLiving: living,
            extraPayment: 0,
            filingStatus: 'single',
            location: loc,
            isIndianLoan: isIndian,
            fxRate,
            depreciation: indiaDepreciation,
            bonusPercent: bonus,
            signingBonus: signing,
            savingsRate: saveRate,
            targetPayoffYears: payoffYr,
            annualStock,
            startingNetWorth,
        });

        return {
            result, salary, living, saveRate, loc, rate,
            // Monthly figures (base salary only)
            monthlyTax, monthlySav, disposableMonthly, required,
            // Yearly figures (salary + bonus + signing)
            yearlyComp, yearlyTax, yearlySav, disposableYearly,
            annualBonus, signing, annualStock,
        };
    }

    const boothPerson = computePerson('booth', 'booth', boothLoanSource, boothLocation);
    const kelloggPerson = computePerson('kellogg', 'kellogg', kelloggLoanSource, kelloggLocation);

    // Per-person charts
    createPayoffChart('payoff-chart-booth', boothPerson.result);
    createNetWorthChart('networth-chart-booth', boothPerson.result);
    createPayoffChart('payoff-chart-kellogg', kelloggPerson.result);
    createNetWorthChart('networth-chart-kellogg', kelloggPerson.result);

    // Household summary
    $('hh-booth-total-paid').textContent = formatUSD(boothPerson.result.totalPaid);
    $('hh-kellogg-total-paid').textContent = formatUSD(kelloggPerson.result.totalPaid);
    $('hh-total-paid').textContent = formatUSD(boothPerson.result.totalPaid + kelloggPerson.result.totalPaid);

    // Household balance sheet
    renderHouseholdBalanceSheet(boothPerson, kelloggPerson);

    // Household charts
    createHouseholdPayoffChart('payoff-chart', boothPerson.result, kelloggPerson.result);
    createHouseholdNetWorthChart('networth-chart', boothPerson.result, kelloggPerson.result);

    // Household cash flow table
    renderHouseholdCashFlowTable(boothPerson, kelloggPerson);
}

/* ── HOUSEHOLD BALANCE SHEET ────────────────────────────────────── */
function renderHouseholdBalanceSheet(b, k) {
    const isYearly = hhBsPeriod === 'yearly';
    const tbody = $('hh-bs-body');
    if (!tbody) return;

    const bState = LOCATIONS.find(l => l.key === b.loc)?.state || 'IL';
    const kState = LOCATIONS.find(l => l.key === k.loc)?.state || 'IL';

    let rows;
    if (isYearly) {
        rows = [
            { label: 'Base Salary', bv: b.salary, kv: k.salary, cls: '' },
            { label: 'Annual Bonus', bv: b.annualBonus, kv: k.annualBonus, cls: '' },
        ];
        if (b.signing > 0 || k.signing > 0) rows.push({ label: 'Signing Bonus', bv: b.signing, kv: k.signing, cls: '' });
        if (b.annualStock > 0 || k.annualStock > 0) rows.push({ label: 'Stock/Equity', bv: b.annualStock, kv: k.annualStock, cls: '' });
        rows.push(
            { label: 'Total Pre-Tax Income', bv: b.yearlyComp, kv: k.yearlyComp, cls: 'hh-bs-net' },
            { label: 'Federal Tax', bv: -b.yearlyTax.federal, kv: -k.yearlyTax.federal, cls: 'hh-bs-sub' },
            { label: `State Tax (${bState}/${kState})`, bv: -b.yearlyTax.state, kv: -k.yearlyTax.state, cls: 'hh-bs-sub' },
            { label: 'FICA', bv: -b.yearlyTax.fica, kv: -k.yearlyTax.fica, cls: 'hh-bs-sub' },
            { label: 'Post-Tax Income', bv: b.yearlyTax.netAnnual, kv: k.yearlyTax.netAnnual, cls: 'hh-bs-net' },
            { label: 'Living Expenses', bv: -b.living * 12, kv: -k.living * 12, cls: 'hh-bs-expense' },
            { label: `Savings (${b.saveRate}%/${k.saveRate}%)`, bv: -b.yearlySav, kv: -k.yearlySav, cls: 'hh-bs-expense' },
            { label: 'Loan Repayment', bv: -b.required * 12, kv: -k.required * 12, cls: 'hh-bs-expense' },
            { label: 'Disposable', bv: b.disposableYearly, kv: k.disposableYearly, cls: 'hh-bs-bottom' },
        );
    } else {
        rows = [
            { label: 'Pre-Tax Income', bv: b.salary / 12, kv: k.salary / 12, cls: '' },
            { label: 'Federal Tax', bv: -b.monthlyTax.federal / 12, kv: -k.monthlyTax.federal / 12, cls: 'hh-bs-sub' },
            { label: `State Tax (${bState}/${kState})`, bv: -b.monthlyTax.state / 12, kv: -k.monthlyTax.state / 12, cls: 'hh-bs-sub' },
            { label: 'FICA', bv: -b.monthlyTax.fica / 12, kv: -k.monthlyTax.fica / 12, cls: 'hh-bs-sub' },
            { label: 'Post-Tax Income', bv: b.monthlyTax.netMonthly, kv: k.monthlyTax.netMonthly, cls: 'hh-bs-net' },
            { label: 'Living Expenses', bv: -b.living, kv: -k.living, cls: 'hh-bs-expense' },
            { label: `Savings (${b.saveRate}%/${k.saveRate}%)`, bv: -b.monthlySav, kv: -k.monthlySav, cls: 'hh-bs-expense' },
            { label: 'Loan Repayment', bv: -b.required, kv: -k.required, cls: 'hh-bs-expense' },
            { label: 'Disposable', bv: b.disposableMonthly, kv: k.disposableMonthly, cls: 'hh-bs-bottom' },
        ];
    }

    tbody.innerHTML = rows.map(r => {
        const hv = r.bv + r.kv;
        return `<tr class="${r.cls}">
            <td>${r.label}</td>
            <td>${formatUSD(r.bv)}</td>
            <td>${formatUSD(r.kv)}</td>
            <td>${formatUSD(hv)}</td>
        </tr>`;
    }).join('');
}

/* ── HOUSEHOLD CHARTS ──────────────────────────────────────────── */
function createHouseholdPayoffChart(canvasId, boothResult, kelloggResult) {
    destroyChart('payoff');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const maxMonth = Math.max(boothResult.timeline.length, kelloggResult.timeline.length);

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: { type: 'linear', min: 0, title: { display: true, text: 'Months After Graduation', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } }, ticks: { color: CHART_COLORS.textMuted, font: { family: "'JetBrains Mono', monospace", size: 10 }, callback: function(v) { return v % 12 === 0 ? 'Yr ' + (v / 12) : ''; }, stepSize: 6 }, grid: { color: CHART_COLORS.grid, lineWidth: 0.5 } },
            y: { stacked: true, title: { display: true, text: 'Remaining (Principal + Interest)', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } } },
        },
    });

    const bTotalInt = boothResult.totalInterest || 0;
    const kTotalInt = kelloggResult.totalInterest || 0;

    chartInstances.payoff = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Booth', data: boothResult.timeline.map(e => ({ x: e.month, y: e.balance + (bTotalInt - e.cumulativeInterest) })), borderColor: CHART_COLORS.booth.main, backgroundColor: 'rgba(165, 42, 42, 0.3)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2, stack: 'stack' },
                { label: 'Kellogg', data: kelloggResult.timeline.map(e => ({ x: e.month, y: e.balance + (kTotalInt - e.cumulativeInterest) })), borderColor: CHART_COLORS.kellogg.main, backgroundColor: 'rgba(123, 82, 171, 0.3)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.2, stack: 'stack' },
            ],
        },
        options,
    });
}

function createHouseholdNetWorthChart(canvasId, boothResult, kelloggResult) {
    destroyChart('netWorth');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const maxLen = Math.max(boothResult.timeline.length, kelloggResult.timeline.length);
    const householdData = [];
    for (let i = 0; i < maxLen; i++) {
        const bNw = i < boothResult.timeline.length ? boothResult.timeline[i].netWorth : (boothResult.timeline[boothResult.timeline.length - 1]?.netWorth || 0);
        const kNw = i < kelloggResult.timeline.length ? kelloggResult.timeline[i].netWorth : (kelloggResult.timeline[kelloggResult.timeline.length - 1]?.netWorth || 0);
        const month = (i < boothResult.timeline.length ? boothResult.timeline[i].month : i + 1);
        householdData.push({ x: month, y: bNw + kNw });
    }

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: { type: 'linear', min: 0, title: { display: true, text: 'Months After Graduation', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } }, ticks: { color: CHART_COLORS.textMuted, font: { family: "'JetBrains Mono', monospace", size: 10 }, callback: function(v) { return v % 12 === 0 ? 'Yr ' + (v / 12) : ''; }, stepSize: 6 }, grid: { color: CHART_COLORS.grid, lineWidth: 0.5 } },
            y: { title: { display: true, text: 'Net Worth', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } } },
        },
        plugins: { ...DARK_THEME.plugins, annotation: { annotations: { zeroLine: { type: 'line', yMin: 0, yMax: 0, borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1, borderDash: [6, 3] } } } },
    });

    chartInstances.netWorth = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                { label: 'Booth', data: boothResult.timeline.map(e => ({ x: e.month, y: e.netWorth })), borderColor: CHART_COLORS.booth.main, backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 3], pointRadius: 0, tension: 0.2 },
                { label: 'Kellogg', data: kelloggResult.timeline.map(e => ({ x: e.month, y: e.netWorth })), borderColor: CHART_COLORS.kellogg.main, backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [6, 3], pointRadius: 0, tension: 0.2 },
                { label: 'Household', data: householdData, borderColor: CHART_COLORS.positive.main, backgroundColor: 'transparent', borderWidth: 2.5, pointRadius: 0, tension: 0.2 },
            ],
        },
        options,
    });
}

/* ── HOUSEHOLD CASH FLOW TABLE ─────────────────────────────────── */
function renderHouseholdCashFlowTable(boothPerson, kelloggPerson) {
    const tbody = $('cashflow-table-body');
    tbody.innerHTML = '';

    // Aggregate by year from both timelines
    const years = {};

    function addToYear(timeline, person, loc) {
        for (const e of timeline) {
            if (!years[e.year]) years[e.year] = { year: e.year, income: 0, tax: 0, living: 0, savings: 0, loan: 0, interest: 0, disposable: 0 };
            const monthlyGross = (e.totalComp || e.salary) / 12;
            const tax = calcPostTax(e.totalComp || e.salary, 'single', loc);
            years[e.year].income += monthlyGross;
            years[e.year].tax += tax.totalTax / 12;
            years[e.year].living += person.living;
            years[e.year].savings += e.monthlySavings || 0;
            years[e.year].loan += e.payment;
            years[e.year].interest += e.interest || 0;
            years[e.year].disposable += e.leftover || 0;
        }
    }

    addToYear(boothPerson.result.timeline, boothPerson, boothLocation);
    addToYear(kelloggPerson.result.timeline, kelloggPerson, kelloggLocation);

    // First pass: compute balance and net worth per year
    const yearKeys = Object.keys(years).map(Number).sort((a, b) => a - b);
    for (const yr of yearKeys) {
        const row = years[yr];
        const boothEnd = boothPerson.result.timeline.filter(e => e.year === yr).pop();
        const kelloggEnd = kelloggPerson.result.timeline.filter(e => e.year === yr).pop();
        row.principalBalance = (boothEnd?.balance || 0) + (kelloggEnd?.balance || 0);
        row.netWorth = (boothEnd?.netWorth || 0) + (kelloggEnd?.netWorth || 0);
    }

    // Second pass: add next year's interest to this year's balance
    for (let i = 0; i < yearKeys.length; i++) {
        const row = years[yearKeys[i]];
        const nextYear = years[yearKeys[i + 1]];
        row.balance = row.principalBalance + (nextYear ? nextYear.interest : 0);
    }

    // Render
    for (const yr of yearKeys) {
        const row = years[yr];
        const nwColor = row.netWorth >= 0 ? 'var(--positive)' : 'var(--negative)';
        const dispColor = row.disposable >= 0 ? 'var(--positive)' : 'var(--negative)';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Year ${yr}</td>
            <td>${formatUSD(row.income)}</td>
            <td>${formatUSD(row.tax)}</td>
            <td>${formatUSD(row.living)}</td>
            <td>${formatUSD(row.savings)}</td>
            <td>${formatUSD(row.loan)}</td>
            <td style="color:${dispColor};">${formatUSD(row.disposable)}</td>
            <td>${formatUSD(row.balance)}</td>
            <td style="color:${nwColor}; font-weight:600;">${formatUSD(row.netWorth)}</td>
        `;
        tbody.appendChild(tr);
    }
}
