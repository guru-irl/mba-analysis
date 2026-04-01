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
    ['annual-salary', 'annual-salary-num'],
    ['salary-growth', 'salary-growth-num'],
    ['post-mba-living', 'post-mba-living-num'],
    ['extra-payment', 'extra-payment-num'],
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
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');

            const target = btn.dataset.tab;
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            const panel = $('tab-' + target);
            if (panel) panel.classList.add('active');

            // Trigger chart resize on tab switch
            setTimeout(() => {
                Object.values(chartInstances).forEach(c => { if (c) c.resize(); });
            }, 50);
        });
    });
}

/* ── TOGGLE BUTTONS ────────────────────────────────────────────── */
let payoffProgram = 'booth';
let payoffSource = 'us';
let loanYear = '1';            // '1' or '2'
let breakevenProgram = 'booth';
let costCurrency = 'usd';      // 'usd' or 'inr'

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
    initToggleGroup(['payoff-booth', 'payoff-kellogg'], el => {
        payoffProgram = el.dataset.program;
    });
    initToggleGroup(['payoff-us', 'payoff-india'], el => {
        payoffSource = el.dataset.source;
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

    const annualSalary = parseFloat($('annual-salary').value) || 0;
    const salaryGrowth = parseFloat($('salary-growth').value) || 0;
    const postMbaLiving = parseFloat($('post-mba-living').value) || 0;
    const extraPayment = parseFloat($('extra-payment').value) || 0;

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

    // ── Tab 2: Payoff Analysis ──
    const selectedPrincipal = payoffProgram === 'booth' ? totalBooth : totalKellogg;
    const selectedRate = payoffSource === 'us' ? usRate : indiaRate;
    const isIndianLoan = payoffSource === 'india';

    const payoffResult = calcPayoffTimeline({
        loanBalance: selectedPrincipal,
        annualLoanRate: selectedRate,
        salary: annualSalary,
        salaryGrowth,
        monthlyLiving: postMbaLiving,
        extraPayment,
        filingStatus: 'single',
        isIndianLoan,
        fxRate,
        depreciation: indiaDepreciation,
    });

    // Summary cards
    $('payoff-time').textContent = payoffResult.paidOff
        ? formatMonths(payoffResult.totalMonths)
        : '30+ years';
    $('total-paid').textContent = formatUSD(payoffResult.totalPaid);
    $('total-interest-paid').textContent = formatUSD(payoffResult.totalInterest);

    if (!payoffResult.paidOff) {
        $('payoff-time').parentElement.querySelector('.card-detail').textContent = 'may not pay off at this rate';
    } else {
        $('payoff-time').parentElement.querySelector('.card-detail').textContent = 'from graduation';
    }

    // Payoff trajectory chart
    createPayoffChart('payoff-chart', payoffResult);

    // Net worth chart
    createNetWorthChart('networth-chart', payoffResult);

    // Salary sensitivity
    const sensitivityData = calcSalarySensitivity(annualSalary, {
        loanBalance: selectedPrincipal,
        annualLoanRate: selectedRate,
        salaryGrowth,
        monthlyLiving: postMbaLiving,
        extraPayment,
        filingStatus: 'single',
        isIndianLoan,
        fxRate,
        depreciation: indiaDepreciation,
    });
    createSensitivityChart('sensitivity-chart', sensitivityData);

    // Cash flow table
    const cashFlow = calcAnnualCashFlow(
        payoffResult.timeline, annualSalary, salaryGrowth, postMbaLiving, 'single'
    );
    renderCashFlowTable(cashFlow);
}

/* ── CASH FLOW TABLE RENDERER ──────────────────────────────────── */
function renderCashFlowTable(cashFlow) {
    const tbody = $('cashflow-table-body');
    tbody.innerHTML = '';

    for (const row of cashFlow) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Year ${row.year}</td>
            <td>${formatUSD(row.grossIncome)}</td>
            <td>${formatUSD(row.totalTax)}</td>
            <td>${formatUSD(row.livingExpenses)}</td>
            <td>${formatUSD(row.loanPayments)}</td>
            <td>${formatUSD(row.balance)}</td>
        `;
        tbody.appendChild(tr);
    }
}
