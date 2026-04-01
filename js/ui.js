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
    return '₹' + Math.round(val).toLocaleString('en-IN');
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
    ['rent-monthly', 'rent-monthly-num'],
    ['food-monthly', 'food-monthly-num'],
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
    ['early-payoff', 'early-payoff-num'],
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

/* ── TOGGLE BUTTONS (Tab 2) ────────────────────────────────────── */
let payoffProgram = 'booth';
let payoffSource = 'us';

function initToggles() {
    $('payoff-booth').addEventListener('click', () => {
        payoffProgram = 'booth';
        $('payoff-booth').classList.add('active');
        $('payoff-kellogg').classList.remove('active');
        scheduleUpdate();
    });

    $('payoff-kellogg').addEventListener('click', () => {
        payoffProgram = 'kellogg';
        $('payoff-kellogg').classList.add('active');
        $('payoff-booth').classList.remove('active');
        scheduleUpdate();
    });

    $('payoff-us').addEventListener('click', () => {
        payoffSource = 'us';
        $('payoff-us').classList.add('active');
        $('payoff-india').classList.remove('active');
        scheduleUpdate();
    });

    $('payoff-india').addEventListener('click', () => {
        payoffSource = 'india';
        $('payoff-india').classList.add('active');
        $('payoff-us').classList.remove('active');
        scheduleUpdate();
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
    const rentMonthly = parseFloat($('rent-monthly').value) || 0;
    const foodMonthly = parseFloat($('food-monthly').value) || 0;

    const usRate = parseFloat($('us-rate').value) || 0;
    const usTerm = parseInt($('us-term').value) || 10;

    const indiaRate = parseFloat($('india-rate').value) || 0;
    const indiaTerm = parseInt($('india-term').value) || 10;
    const indiaProcessing = parseFloat($('india-processing').value) || 0;
    const indiaForex = parseFloat($('india-forex').value) || 0;
    const indiaSwift = parseFloat($('india-swift').value) || 0;
    const fxRate = parseFloat($('fx-rate').value) || 93;
    const indiaDepreciation = parseFloat($('india-depreciation').value) || 0;

    const earlyPayoff = parseInt($('early-payoff').value) || 10;

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

    // ── Living expenses ──
    const boothLiving = calcLivingExpenses(rentMonthly, foodMonthly, PROGRAMS.booth.programMonths);
    const kelloggLiving = calcLivingExpenses(rentMonthly, foodMonthly, PROGRAMS.kellogg.programMonths);

    $('monthly-living').textContent = formatUSD(boothLiving.monthly);
    $('booth-living-total').textContent = formatUSD(boothLiving.total);
    $('kellogg-living-total').textContent = formatUSD(kelloggLiving.total);

    // ── Total costs ──
    const totalBooth = calcTotalCost(boothTuition.netTuition, boothLiving.total);
    const totalKellogg = calcTotalCost(kelloggTuition.netTuition, kelloggLiving.total);
    const diff = totalKellogg - totalBooth;

    $('total-cost-booth').textContent = formatUSD(totalBooth);
    $('total-cost-kellogg').textContent = formatUSD(totalKellogg);
    $('total-cost-diff').textContent = (diff >= 0 ? '+' : '') + formatUSD(Math.abs(diff));
    $('total-cost-diff').parentElement.querySelector('.card-detail').textContent =
        diff >= 0 ? 'Kellogg costs more' : 'Booth costs more';

    // ── US Loan ──
    const usBoothLoan = calcUSLoan(totalBooth, usRate, usTerm);
    const usKelloggLoan = calcUSLoan(totalKellogg, usRate, usTerm);

    $('us-booth-monthly').textContent = formatUSD(usBoothLoan.monthlyPayment);
    $('us-booth-total-interest').textContent = formatUSD(usBoothLoan.totalInterest);
    $('us-booth-total-cost').textContent = formatUSD(usBoothLoan.totalPaid);
    $('us-kellogg-monthly').textContent = formatUSD(usKelloggLoan.monthlyPayment);
    $('us-kellogg-total-interest').textContent = formatUSD(usKelloggLoan.totalInterest);
    $('us-kellogg-total-cost').textContent = formatUSD(usKelloggLoan.totalPaid);

    // ── Indian Loan ──
    const indiaParams = {
        processingFee: indiaProcessing,
        forexMarkup: indiaForex,
        swiftFee: indiaSwift,
        fxRate,
        depreciation: indiaDepreciation,
    };

    const indiaBoothLoan = calcIndianLoan(totalBooth, indiaRate, indiaTerm, {
        ...indiaParams, quarters: PROGRAMS.booth.quarters,
    });
    const indiaKelloggLoan = calcIndianLoan(totalKellogg, indiaRate, indiaTerm, {
        ...indiaParams, quarters: PROGRAMS.kellogg.quarters,
    });

    $('india-booth-emi').textContent = formatINR(indiaBoothLoan.emiINR);
    $('india-booth-processing-cost').textContent = formatINR(indiaBoothLoan.processingFeeINR);
    $('india-booth-forex-cost').textContent = formatUSD(indiaBoothLoan.disbursementCostUSD);
    $('india-booth-tcs-cost').textContent = formatINR(indiaBoothLoan.tcsAmount);
    $('india-booth-effective-total').textContent = formatUSD(indiaBoothLoan.effectiveTotalUSD);
    $('india-kellogg-emi').textContent = formatINR(indiaKelloggLoan.emiINR);
    $('india-kellogg-processing-cost').textContent = formatINR(indiaKelloggLoan.processingFeeINR);
    $('india-kellogg-forex-cost').textContent = formatUSD(indiaKelloggLoan.disbursementCostUSD);
    $('india-kellogg-tcs-cost').textContent = formatINR(indiaKelloggLoan.tcsAmount);
    $('india-kellogg-effective-total').textContent = formatUSD(indiaKelloggLoan.effectiveTotalUSD);

    // ── Breakeven Chart ──
    // Use Booth principal for breakeven (user's program)
    const breakevenPrincipal = totalBooth;
    const breakevenQuarters = PROGRAMS.booth.quarters;
    const depRates = [
        Math.max(indiaDepreciation - 1.5, -2),
        indiaDepreciation,
        Math.min(indiaDepreciation + 1.5, 10),
    ];

    const breakevenIndiaParams = { ...indiaParams, quarters: breakevenQuarters, term: indiaTerm };
    const breakevenData = calcBreakevenChartData(
        breakevenPrincipal, usRate, usTerm,
        breakevenIndiaParams, depRates, earlyPayoff
    );
    createBreakevenChart('breakeven-chart', breakevenData);

    // Breakeven text
    const breakevenResult = calcBreakevenRate(
        breakevenPrincipal, usRate, usTerm,
        breakevenIndiaParams, earlyPayoff
    );
    const payoffNote = earlyPayoff < Math.min(usTerm, indiaTerm)
        ? ` Assumes early payoff in <strong>${earlyPayoff}</strong> years.`
        : '';
    if (breakevenResult.rate !== null) {
        $('breakeven-text').innerHTML =
            `At <strong>${indiaDepreciation}%</strong> annual INR depreciation, an Indian bank loan is cheaper when the rate is below <strong>${breakevenResult.rate.toFixed(2)}%</strong>. ` +
            `Currently comparing against US loan at <strong>${usRate}%</strong> APR.` + payoffNote;
    } else {
        $('breakeven-text').innerHTML = breakevenResult.message + payoffNote;
    }

    // ── Cost Comparison Bar Chart ──
    const usBoothInterest = usBoothLoan.totalInterest;
    const usKelloggInterest = usKelloggLoan.totalInterest;
    const indiaBoothInterest = indiaBoothLoan.effectiveTotalUSD - totalBooth - indiaBoothLoan.disbursementCostUSD - indiaBoothLoan.tcsUSD;
    const indiaKelloggInterest = indiaKelloggLoan.effectiveTotalUSD - totalKellogg - indiaKelloggLoan.disbursementCostUSD - indiaKelloggLoan.tcsUSD;

    createCostComparisonChart('cost-comparison-chart', {
        principal: [totalBooth, totalBooth, totalKellogg, totalKellogg],
        interest: [usBoothInterest, Math.max(indiaBoothInterest, 0), usKelloggInterest, Math.max(indiaKelloggInterest, 0)],
        fees: [0, indiaBoothLoan.disbursementCostUSD + indiaBoothLoan.tcsUSD, 0, indiaKelloggLoan.disbursementCostUSD + indiaKelloggLoan.tcsUSD],
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
