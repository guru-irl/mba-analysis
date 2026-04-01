/* ═══════════════════════════════════════════════════════════════
   data.js — Constants, tuition data, loan defaults, historical FX
   ═══════════════════════════════════════════════════════════════ */

const PROGRAMS = {
    booth: {
        name: 'Booth MBA/MPCS',
        school: 'University of Chicago',
        tuition: { year1: 96084, year2: 92619 },
        totalFees: 6199,
        grossTotal: 194902,
        quarters: 6,
        programMonths: 21,
        // Per-year breakdown for year-over-year loan analysis
        years: {
            1: { tuition: 96084, fees: 4690, months: 12, quarters: 3 },
            // fees: services $1,509 + admin $3,100 + transcript $81
            2: { tuition: 92619, fees: 1509, months: 9, quarters: 3 },
            // fees: services $1,509 only
        },
    },
    kellogg: {
        name: 'Kellogg MMM',
        school: 'Northwestern University',
        tuition: { year1: 115160, year2: 86370 },
        totalFees: 7603,
        grossTotal: 209133,
        quarters: 7,                  // 4 Y1 (incl. summer) + 3 Y2
        programMonths: 24,            // full 2 years
        // Per-year breakdown — Y1 higher due to summer quarter
        years: {
            1: { tuition: 115160, fees: 5091, months: 12, quarters: 4 },
            // fees: material $310 + health $861 + activity $1,400 + assoc $520 + first-year $2,000
            2: { tuition: 86370, fees: 2512, months: 12, quarters: 3 },
            // fees: loan fees $2,512
        },
    },
};

const LOAN_DEFAULTS = {
    us: {
        minRate: 2.50,
        maxRate: 10.24,
        defaultRate: 5.50,
        minTerm: 5,
        maxTerm: 20,
        defaultTerm: 10,
        // Earnest charges zero fees
        originationFee: 0,
        lateFee: 0,
        prepaymentPenalty: 0,
    },
    india: {
        minRate: 7.0,
        maxRate: 15.0,
        defaultRate: 9.50,
        minTerm: 5,
        maxTerm: 15,
        defaultTerm: 10,
        defaultProcessingFee: 1.0,     // % of sanctioned amount
        defaultForexMarkup: 2.5,       // % over mid-market rate
        defaultSwiftFee: 20,           // USD per transfer
        correspondentFee: 25,          // USD per transfer (intermediary banks)
        tcsRate: 0.5,                  // % on amounts > ₹7 Lacs
        tcsThreshold: 700000,          // ₹7,00,000
        gstRate: 18,                   // % on processing fee
        defaultFxRate: 93,             // INR per USD (updated at runtime via API)
        defaultDepreciation: 3.5,      // % annual
    },
};

// Historical INR/USD exchange rates (year-end approximate)
const FX_HISTORY = [
    { year: 2016, rate: 66.46, depreciation: 5.5 },
    { year: 2017, rate: 67.79, depreciation: 2.0 },
    { year: 2018, rate: 70.09, depreciation: 3.4 },
    { year: 2019, rate: 70.39, depreciation: 0.4 },
    { year: 2020, rate: 76.38, depreciation: 8.5 },
    { year: 2021, rate: 74.57, depreciation: -2.4 },
    { year: 2022, rate: 81.35, depreciation: 9.1 },
    { year: 2023, rate: 81.94, depreciation: 0.7 },
    { year: 2024, rate: 84.83, depreciation: 3.5 },
    { year: 2025, rate: 88.72, depreciation: 4.6 },
];

// US Federal tax brackets (2025, single filer)
const FEDERAL_TAX = {
    standardDeduction: {
        single: 14600,
        married: 29200,
    },
    brackets: [
        { limit: 11600,  rate: 0.10 },
        { limit: 47150,  rate: 0.12 },
        { limit: 100525, rate: 0.22 },
        { limit: 191950, rate: 0.24 },
        { limit: 243725, rate: 0.32 },
        { limit: 609350, rate: 0.35 },
        { limit: Infinity, rate: 0.37 },
    ],
    fica: {
        ssRate: 0.062,
        ssCap: 168600,
        medicareRate: 0.0145,
        additionalMedicareRate: 0.009,
        additionalMedicareThreshold: 200000,
    },
};

// Illinois state tax (flat rate)
const STATE_TAX = {
    illinois: {
        rate: 0.0495,
        type: 'flat',
    },
};

// Chart colors (reusable)
const CHART_COLORS = {
    booth: { main: '#A52A2A', light: 'rgba(165, 42, 42, 0.3)', border: 'rgba(165, 42, 42, 0.8)' },
    kellogg: { main: '#7B52AB', light: 'rgba(123, 82, 171, 0.3)', border: 'rgba(123, 82, 171, 0.8)' },
    usLoan: { main: '#3B82F6', light: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 0.8)' },
    indiaLoan: { main: '#F59E0B', light: 'rgba(245, 158, 11, 0.3)', border: 'rgba(245, 158, 11, 0.8)' },
    positive: { main: '#10B981', light: 'rgba(16, 185, 129, 0.3)', border: 'rgba(16, 185, 129, 0.8)' },
    negative: { main: '#EF4444', light: 'rgba(239, 68, 68, 0.3)', border: 'rgba(239, 68, 68, 0.8)' },
    neutral: { main: '#6B7280', light: 'rgba(107, 114, 128, 0.3)', border: 'rgba(107, 114, 128, 0.8)' },
    grid: 'rgba(255, 255, 255, 0.06)',
    gridBorder: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#E2E4EA',
    textSecondary: '#8B8FA3',
    textMuted: '#555A70',
    surface: '#141722',
};
