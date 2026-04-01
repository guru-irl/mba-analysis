/* ═══════════════════════════════════════════════════════════════
   charts.js — Chart.js chart creation and update functions
   ═══════════════════════════════════════════════════════════════ */

// Store chart instances for updates
const chartInstances = {};

// Common chart options for dark theme
const DARK_THEME = {
    color: CHART_COLORS.textSecondary,
    borderColor: CHART_COLORS.gridBorder,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            labels: {
                color: CHART_COLORS.textSecondary,
                font: { family: "'Sora', sans-serif", size: 11 },
                padding: 16,
                usePointStyle: true,
                pointStyle: 'circle',
                boxWidth: 8,
                boxHeight: 8,
            },
        },
        tooltip: {
            backgroundColor: 'rgba(20, 23, 34, 0.95)',
            titleColor: CHART_COLORS.textPrimary,
            bodyColor: CHART_COLORS.textSecondary,
            borderColor: CHART_COLORS.gridBorder,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: "'Sora', sans-serif", size: 12, weight: '600' },
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
            callbacks: {
                label: function(ctx) {
                    const val = ctx.parsed.y;
                    if (Math.abs(val) >= 1000) {
                        return ctx.dataset.label + ': $' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
                    }
                    return ctx.dataset.label + ': ' + val.toLocaleString('en-US', { maximumFractionDigits: 2 });
                },
            },
        },
    },
    scales: {
        x: {
            ticks: { color: CHART_COLORS.textMuted, font: { family: "'JetBrains Mono', monospace", size: 10 } },
            grid: { color: CHART_COLORS.grid, lineWidth: 0.5 },
        },
        y: {
            ticks: {
                color: CHART_COLORS.textMuted,
                font: { family: "'JetBrains Mono', monospace", size: 10 },
                callback: function(v) { return '$' + (v / 1000).toFixed(0) + 'k'; },
            },
            grid: { color: CHART_COLORS.grid, lineWidth: 0.5 },
        },
    },
};

function destroyChart(name) {
    if (chartInstances[name]) {
        chartInstances[name].destroy();
        chartInstances[name] = null;
    }
}

function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        const val = source[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && typeof val !== 'function') {
            result[key] = deepMerge(result[key] || {}, val);
        } else {
            result[key] = val;
        }
    }
    return result;
}

/* ── BREAKEVEN CHART ───────────────────────────────────────────── */
function createBreakevenChart(canvasId, data) {
    destroyChart('breakeven');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const depColors = ['rgba(59, 130, 246, 0.7)', 'rgba(245, 158, 11, 0.9)', 'rgba(239, 68, 68, 0.7)'];
    const depDashes = [[8, 4], [], [4, 4]];

    // Use {x, y} point data for linear x-axis (needed for annotations)
    const datasets = data.datasets.map((ds, i) => ({
        label: `Indian @ ${ds.depreciation.toFixed(1)}% dep.`,
        data: data.ratePoints.map((r, j) => ({ x: r, y: ds.costs[j] })),
        borderColor: depColors[i],
        backgroundColor: 'transparent',
        borderWidth: i === 1 ? 2.5 : 1.5,
        borderDash: depDashes[i],
        pointRadius: 0,
        tension: 0.3,
    }));

    // US loan total cost — horizontal line
    datasets.unshift({
        label: 'US Loan Total Cost',
        data: data.ratePoints.map(r => ({ x: r, y: data.usTotal })),
        borderColor: CHART_COLORS.usLoan.main,
        backgroundColor: CHART_COLORS.usLoan.light,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
    });

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: {
                type: 'linear',
                min: data.ratePoints[0],
                max: data.ratePoints[data.ratePoints.length - 1],
                title: { display: true, text: 'Indian Loan Interest Rate (%)', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    callback: function(v) { return v + '%'; },
                    stepSize: 1,
                },
                grid: { color: CHART_COLORS.grid, lineWidth: 0.5 },
            },
            y: {
                title: { display: true, text: 'Total Loan Cost (USD)', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
            },
        },
        plugins: {
            ...DARK_THEME.plugins,
            annotation: {
                annotations: {},
            },
        },
    });

    // Find breakeven point for the primary depreciation rate (middle dataset)
    const primaryCosts = data.datasets[1]?.costs || data.datasets[0]?.costs;
    if (primaryCosts) {
        for (let i = 0; i < primaryCosts.length - 1; i++) {
            if (primaryCosts[i] <= data.usTotal && primaryCosts[i + 1] > data.usTotal) {
                // Linear interpolation
                const x0 = data.ratePoints[i];
                const x1 = data.ratePoints[i + 1];
                const y0 = primaryCosts[i];
                const y1 = primaryCosts[i + 1];
                const breakevenRate = x0 + (data.usTotal - y0) * (x1 - x0) / (y1 - y0);

                options.plugins.annotation.annotations.breakeven = {
                    type: 'line',
                    xMin: breakevenRate,
                    xMax: breakevenRate,
                    borderColor: 'rgba(255,255,255,0.5)',
                    borderWidth: 1.5,
                    borderDash: [6, 3],
                    label: {
                        display: true,
                        content: `Breakeven: ${breakevenRate.toFixed(2)}%`,
                        position: 'start',
                        backgroundColor: 'rgba(20, 23, 34, 0.9)',
                        color: CHART_COLORS.textPrimary,
                        font: { family: "'JetBrains Mono', monospace", size: 11 },
                        padding: 6,
                    },
                };
                break;
            }
        }
    }

    chartInstances.breakeven = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options,
    });
}

/* ── COST COMPARISON BAR CHART ─────────────────────────────────── */
function createCostComparisonChart(canvasId, data) {
    destroyChart('costComparison');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const isINR = data.currency === 'inr';
    const symbol = isINR ? '₹' : '$';

    const yTickCallback = isINR
        ? function(v) {
            if (v >= 10000000) return '₹' + (v / 10000000).toFixed(1) + 'Cr';
            if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L';
            return '₹' + (v / 1000).toFixed(0) + 'k';
        }
        : function(v) { return '$' + (v / 1000).toFixed(0) + 'k'; };

    const tooltipLabel = function(ctx) {
        const val = ctx.parsed.y;
        if (isINR) {
            if (Math.abs(val) >= 10000000) return ctx.dataset.label + ': ₹' + (val / 10000000).toFixed(2) + ' Cr';
            if (Math.abs(val) >= 100000) return ctx.dataset.label + ': ₹' + (val / 100000).toFixed(2) + ' L';
            return ctx.dataset.label + ': ₹' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
        }
        return ctx.dataset.label + ': $' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: {
                ticks: { font: { size: 10 } },
            },
        },
        plugins: {
            ...DARK_THEME.plugins,
            tooltip: {
                ...DARK_THEME.plugins.tooltip,
                mode: 'index',
                callbacks: { label: tooltipLabel },
            },
        },
    });

    chartInstances.costComparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Booth — US', 'Booth — India', 'Kellogg — US', 'Kellogg — India'],
            datasets: [
                {
                    label: 'Principal',
                    data: data.principal,
                    backgroundColor: 'rgba(107, 114, 128, 0.7)',
                    borderRadius: 4,
                },
                {
                    label: 'Interest',
                    data: data.interest,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderRadius: 4,
                },
                {
                    label: 'Fees & FX Costs',
                    data: data.fees,
                    backgroundColor: 'rgba(245, 158, 11, 0.6)',
                    borderRadius: 4,
                },
            ],
        },
        options: {
            ...options,
            scales: {
                ...options.scales,
                x: { ...options.scales.x, stacked: true },
                y: {
                    ...options.scales.y,
                    stacked: true,
                    ticks: {
                        ...options.scales.y?.ticks,
                        callback: yTickCallback,
                    },
                },
            },
        },
    });
}

/* ── FX HISTORY CHART ──────────────────────────────────────────── */
function createFxHistoryChart(canvasId, currentLiveRate) {
    destroyChart('fxHistory');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const years = FX_HISTORY.map(d => d.year.toString());
    const depRates = FX_HISTORY.map(d => d.depreciation);
    const fxRates = FX_HISTORY.map(d => d.rate);

    // If we have a live rate, add 2026 data point
    const lastHistorical = FX_HISTORY[FX_HISTORY.length - 1]; // 2025
    if (currentLiveRate && lastHistorical) {
        const depFromLast = ((currentLiveRate - lastHistorical.rate) / lastHistorical.rate) * 100;
        const depRounded = Math.round(depFromLast * 10) / 10;
        years.push('2026*');
        depRates.push(depRounded);
        fxRates.push(currentLiveRate);
    }

    // Bar colors: red for depreciation, green for appreciation, highlight 2026
    const barColors = depRates.map((d, i) => {
        if (i === depRates.length - 1 && currentLiveRate) {
            // Highlight current year
            return d >= 0 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(16, 185, 129, 0.85)';
        }
        return d >= 0 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(16, 185, 129, 0.6)';
    });

    // Point colors for line: highlight current year
    const pointColors = fxRates.map((_, i) => {
        if (i === fxRates.length - 1 && currentLiveRate) return '#FBBF24';
        return CHART_COLORS.indiaLoan.main;
    });
    const pointRadii = fxRates.map((_, i) => {
        if (i === fxRates.length - 1 && currentLiveRate) return 7;
        return 4;
    });

    const options = deepMerge(DARK_THEME, {
        scales: {
            y: {
                position: 'left',
                title: { display: true, text: 'YoY Depreciation (%)', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 10 } },
                ticks: { callback: v => v + '%' },
            },
            y2: {
                position: 'right',
                title: { display: true, text: 'INR/USD Rate', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 10 } },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    callback: v => '₹' + v,
                },
                grid: { display: false },
            },
        },
    });

    chartInstances.fxHistory = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'YoY Depreciation',
                    data: depRates,
                    backgroundColor: barColors,
                    borderRadius: 4,
                    yAxisID: 'y',
                    order: 2,
                },
                {
                    label: 'INR/USD Rate',
                    data: fxRates,
                    type: 'line',
                    borderColor: CHART_COLORS.indiaLoan.main,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: pointRadii,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    yAxisID: 'y2',
                    tension: 0.3,
                    order: 1,
                },
            ],
        },
        options,
    });
}

/* ── PAYOFF TRAJECTORY CHART ───────────────────────────────────── */
function createPayoffChart(canvasId, data) {
    destroyChart('payoff');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const balanceData = data.timeline.map(e => ({ x: e.month, y: e.balance }));
    const cumPaidData = data.timeline.map(e => ({ x: e.month, y: e.cumulativePaid }));

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: {
                type: 'linear',
                min: 0,
                title: { display: true, text: 'Months After Graduation', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    callback: function(v) { return v % 12 === 0 ? 'Yr ' + (v / 12) : ''; },
                    stepSize: 6,
                },
                grid: { color: CHART_COLORS.grid, lineWidth: 0.5 },
            },
            y: {
                position: 'left',
                title: { display: true, text: 'Remaining Balance', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
            },
            y2: {
                position: 'right',
                title: { display: true, text: 'Cumulative Paid', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    callback: v => '$' + (v / 1000).toFixed(0) + 'k',
                },
                grid: { display: false },
            },
        },
    });

    chartInstances.payoff = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Remaining Balance',
                    data: balanceData,
                    borderColor: CHART_COLORS.negative.main,
                    backgroundColor: CHART_COLORS.negative.light,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.2,
                    yAxisID: 'y',
                },
                {
                    label: 'Cumulative Paid',
                    data: cumPaidData,
                    borderColor: CHART_COLORS.positive.main,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.2,
                    yAxisID: 'y2',
                },
            ],
        },
        options,
    });
}

/* ── NET WORTH CHART ───────────────────────────────────────────── */
function createNetWorthChart(canvasId, data) {
    destroyChart('netWorth');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const netWorthData = data.timeline.map(e => ({ x: e.month, y: e.netWorth }));
    const netWorthValues = data.timeline.map(e => e.netWorth);

    // Find break-even month
    let breakevenMonth = null;
    for (let i = 1; i < data.timeline.length; i++) {
        if (netWorthValues[i - 1] < 0 && netWorthValues[i] >= 0) {
            breakevenMonth = data.timeline[i].month;
            break;
        }
    }

    const annotations = {
        zeroLine: {
            type: 'line',
            yMin: 0,
            yMax: 0,
            borderColor: 'rgba(255,255,255,0.3)',
            borderWidth: 1,
            borderDash: [6, 3],
            label: {
                display: true,
                content: 'Break Even',
                position: 'end',
                backgroundColor: 'rgba(20, 23, 34, 0.9)',
                color: CHART_COLORS.textPrimary,
                font: { family: "'Sora', sans-serif", size: 10 },
            },
        },
    };

    if (breakevenMonth) {
        annotations.breakevenPoint = {
            type: 'point',
            xValue: breakevenMonth,
            yValue: 0,
            radius: 6,
            backgroundColor: CHART_COLORS.positive.main,
            borderColor: '#fff',
            borderWidth: 2,
        };
    }

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: {
                type: 'linear',
                min: 0,
                title: { display: true, text: 'Months After Graduation', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    callback: function(v) { return v % 12 === 0 ? 'Yr ' + (v / 12) : ''; },
                    stepSize: 6,
                },
                grid: { color: CHART_COLORS.grid, lineWidth: 0.5 },
            },
            y: {
                title: { display: true, text: 'Net Worth', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
            },
        },
        plugins: {
            ...DARK_THEME.plugins,
            annotation: { annotations },
        },
    });

    chartInstances.netWorth = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Net Worth',
                data: netWorthData,
                borderColor: CHART_COLORS.positive.main, // legend color
                segment: {
                    borderColor: function(ctx) {
                        return ctx.p1.parsed.y >= 0 ? CHART_COLORS.positive.main : CHART_COLORS.negative.main;
                    },
                },
                backgroundColor: function(ctx) {
                    const chart = ctx.chart;
                    const { chartArea } = chart;
                    if (!chartArea) return CHART_COLORS.negative.light;
                    const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.02)');
                    gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.02)');
                    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
                    return gradient;
                },
                fill: true,
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.2,
            }],
        },
        options,
    });
}

/* ── SALARY SENSITIVITY CHART ──────────────────────────────────── */
function createSensitivityChart(canvasId, data) {
    destroyChart('sensitivity');
    const ctx = document.getElementById(canvasId).getContext('2d');

    const colors = [
        CHART_COLORS.negative.main,
        CHART_COLORS.indiaLoan.main,
        CHART_COLORS.positive.main,
        CHART_COLORS.usLoan.main,
        CHART_COLORS.kellogg.main,
    ];

    const datasets = data.map((scenario, i) => ({
        label: '$' + (scenario.salary / 1000).toFixed(0) + 'k',
        data: scenario.timeline.map(e => ({ x: e.month, y: e.balance })),
        borderColor: colors[i],
        backgroundColor: 'transparent',
        borderWidth: i === 2 ? 2.5 : 1.5,
        borderDash: i === 2 ? [] : [6, 3],
        pointRadius: 0,
        tension: 0.2,
    }));

    const options = deepMerge(DARK_THEME, {
        scales: {
            x: {
                type: 'linear',
                min: 0,
                title: { display: true, text: 'Months After Graduation', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
                ticks: {
                    color: CHART_COLORS.textMuted,
                    font: { family: "'JetBrains Mono', monospace", size: 10 },
                    callback: function(v) { return v % 12 === 0 ? 'Yr ' + (v / 12) : ''; },
                    stepSize: 6,
                },
                grid: { color: CHART_COLORS.grid, lineWidth: 0.5 },
            },
            y: {
                title: { display: true, text: 'Remaining Balance', color: CHART_COLORS.textSecondary, font: { family: "'Sora', sans-serif", size: 11 } },
            },
        },
    });

    chartInstances.sensitivity = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options,
    });
}
