/* ═══════════════════════════════════════════════════════════════
   calc.js — Pure calculation functions (no DOM access)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Calculate net tuition after scholarship.
 * Scholarship is split evenly across payment periods (quarters).
 */
function calcNetTuition(programKey, scholarship) {
    const p = PROGRAMS[programKey];
    const scholarshipPerPeriod = scholarship / p.quarters;
    const netTuition = Math.max(p.grossTotal - scholarship, 0);
    return {
        year1: p.tuition.year1,
        year2: p.tuition.year2,
        fees: p.totalFees,
        grossTotal: p.grossTotal,
        scholarship,
        scholarshipPerPeriod,
        netTuition,
    };
}

/**
 * Calculate cost for a specific year (1 or 2).
 * Scholarship is split proportionally by quarters in that year.
 */
function calcYearCost(programKey, year, scholarship, rentMonthly, foodMonthly) {
    const p = PROGRAMS[programKey];
    const yr = p.years[year];
    const scholarshipForYear = scholarship * (yr.quarters / p.quarters);
    const netTuition = Math.max(yr.tuition + yr.fees - scholarshipForYear, 0);
    const living = (rentMonthly + foodMonthly) * yr.months;
    return {
        tuition: yr.tuition,
        fees: yr.fees,
        scholarshipForYear,
        netTuition,
        living,
        total: netTuition + living,
        months: yr.months,
        quarters: yr.quarters,
    };
}

/**
 * Calculate total living expenses for the program duration.
 */
function calcLivingExpenses(rentMonthly, foodMonthly, months) {
    const monthly = rentMonthly + foodMonthly;
    return {
        monthly,
        total: monthly * months,
    };
}

/**
 * Calculate total cost of attendance (net tuition + living).
 */
function calcTotalCost(netTuition, livingTotal) {
    return netTuition + livingTotal;
}

/**
 * Standard monthly payment formula.
 * M = P * r(1+r)^n / ((1+r)^n - 1)
 */
function calcMonthlyPayment(principal, annualRate, termYears) {
    if (principal <= 0) return 0;
    const r = annualRate / 100 / 12;
    const n = termYears * 12;
    if (r === 0) return principal / n;
    return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

/**
 * Generate full amortization schedule.
 */
function calcAmortizationSchedule(principal, annualRate, termYears) {
    const r = annualRate / 100 / 12;
    const n = termYears * 12;
    const monthlyPmt = calcMonthlyPayment(principal, annualRate, termYears);
    const schedule = [];
    let balance = principal;

    for (let i = 1; i <= n; i++) {
        const interest = balance * r;
        const principalPortion = monthlyPmt - interest;
        balance = Math.max(balance - principalPortion, 0);
        schedule.push({
            month: i,
            payment: monthlyPmt,
            principal: principalPortion,
            interest,
            balance,
        });
    }
    return schedule;
}

/**
 * US Loan calculation (Earnest — no fees).
 */
function calcUSLoan(principal, annualRate, termYears) {
    if (principal <= 0) {
        return { monthlyPayment: 0, totalPaid: 0, totalInterest: 0, schedule: [] };
    }
    const monthlyPayment = calcMonthlyPayment(principal, annualRate, termYears);
    const totalPaid = monthlyPayment * termYears * 12;
    const totalInterest = totalPaid - principal;
    const schedule = calcAmortizationSchedule(principal, annualRate, termYears);
    return { monthlyPayment, totalPaid, totalInterest, schedule };
}

/**
 * Convert US loan to INR-equivalent using depreciation-adjusted rates.
 * If you earn in INR and repay a USD loan, each payment costs more INR over time.
 */
function calcUSLoanINREquivalent(usLoanResult, fxRate, depreciation) {
    const depRate = depreciation / 100;
    let totalPaidINR = 0;
    let totalInterestINR = 0;

    for (const entry of usLoanResult.schedule) {
        const fxAtMonth = fxRate * Math.pow(1 + depRate, entry.month / 12);
        totalPaidINR += entry.payment * fxAtMonth;
        totalInterestINR += entry.interest * fxAtMonth;
    }

    return { totalPaidINR, totalInterestINR };
}

/**
 * Indian Bank Loan calculation with FX modeling.
 *
 * Returns effective total cost in USD, including:
 * - Loan repayment (EMI in INR converted to USD with depreciation)
 * - Processing fee + GST
 * - Forex markup + SWIFT fees on disbursement
 * - TCS (refundable but upfront cost)
 */
function calcIndianLoan(principalUSD, annualRate, termYears, params) {
    if (principalUSD <= 0) {
        return {
            principalINR: 0, processingFeeINR: 0, gstOnProcessing: 0,
            tcsAmount: 0, tcsUSD: 0, emiINR: 0,
            totalRepaymentINR: 0, totalInterestINR: 0,
            totalRepaymentUSD: 0, totalInterestUSD: 0,
            disbursementCostUSD: 0, effectiveTotalUSD: 0,
            monthlyPaymentsUSD: [], schedule: [],
        };
    }

    const {
        processingFee, forexMarkup, swiftFee, fxRate, depreciation, quarters,
    } = params;

    const correspondentFee = LOAN_DEFAULTS.india.correspondentFee;
    const tcsRate = LOAN_DEFAULTS.india.tcsRate / 100;
    const tcsThreshold = LOAN_DEFAULTS.india.tcsThreshold;
    const gstRate = LOAN_DEFAULTS.india.gstRate / 100;

    // Convert principal to INR
    const principalINR = principalUSD * fxRate;

    // Processing fee + GST (in INR)
    const processingFeeINR = principalINR * (processingFee / 100);
    const gstOnProcessing = processingFeeINR * gstRate;
    const totalProcessingINR = processingFeeINR + gstOnProcessing;

    // TCS: 0.5% on amount exceeding ₹7 Lacs
    const tcsBase = Math.max(principalINR - tcsThreshold, 0);
    const tcsAmount = tcsBase * tcsRate;

    // Disbursement costs (forex + SWIFT for each quarterly tranche)
    const trancheUSD = principalUSD / quarters;
    const perTrancheCost = trancheUSD * (forexMarkup / 100) + swiftFee + correspondentFee;
    const disbursementCostUSD = perTrancheCost * quarters;

    // Loan amount = principal + processing (TCS is separate, refundable)
    const loanAmountINR = principalINR + totalProcessingINR;

    // EMI calculation in INR
    const emiINR = calcMonthlyPayment(loanAmountINR, annualRate, termYears);
    const n = termYears * 12;
    const totalRepaymentINR = emiINR * n;

    // Convert each month's EMI to USD-equivalent with depreciation
    // If earner is in USD and paying in INR:
    // fxRate_i = fxRate * (1 + dep)^(i/12) — INR weakens, so fewer USD needed
    const depRate = depreciation / 100;
    const monthlyPaymentsUSD = [];
    let totalRepaymentUSD = 0;
    let totalInterestUSD = 0;
    const scheduleINR = calcAmortizationSchedule(loanAmountINR, annualRate, termYears);

    for (let i = 1; i <= n; i++) {
        const fxRateAtMonth = fxRate * Math.pow(1 + depRate, i / 12);
        const emiUSD = emiINR / fxRateAtMonth;
        monthlyPaymentsUSD.push(emiUSD);
        totalRepaymentUSD += emiUSD;
        // Interest portion for this month in USD
        if (i <= scheduleINR.length) {
            totalInterestUSD += scheduleINR[i - 1].interest / fxRateAtMonth;
        }
    }

    // TCS in USD (paid upfront, refundable after ~1 year)
    const tcsUSD = tcsAmount / fxRate;

    // Effective total cost in USD
    const effectiveTotalUSD = totalRepaymentUSD + disbursementCostUSD + tcsUSD;

    // Interest in INR (total repayment - loan amount)
    const totalInterestINR = totalRepaymentINR - loanAmountINR;

    return {
        principalINR,
        processingFeeINR: totalProcessingINR,
        gstOnProcessing,
        tcsAmount,
        tcsUSD,
        emiINR,
        totalRepaymentINR,
        totalInterestINR,
        totalInterestUSD,
        totalRepaymentUSD,
        disbursementCostUSD,
        effectiveTotalUSD,
        monthlyPaymentsUSD,
        schedule: scheduleINR,
    };
}

/**
 * Total cost of a US loan with early payoff.
 * Pay regular EMI for payoffYears, then lump-sum the remaining balance.
 */
function calcUSLoanTotalCost(principal, annualRate, termYears, payoffYears) {
    if (principal <= 0) return 0;
    payoffYears = Math.min(payoffYears || termYears, termYears);
    if (payoffYears >= termYears) {
        return calcUSLoan(principal, annualRate, termYears).totalPaid;
    }
    const schedule = calcAmortizationSchedule(principal, annualRate, termYears);
    const payoffMonth = payoffYears * 12;
    let totalPaid = 0;
    for (let i = 0; i < payoffMonth && i < schedule.length; i++) {
        totalPaid += schedule[i].payment;
    }
    // Lump-sum remaining balance
    if (payoffMonth > 0 && payoffMonth <= schedule.length) {
        totalPaid += schedule[payoffMonth - 1].balance;
    }
    return totalPaid;
}

/**
 * Total cost (USD-equivalent) of an Indian loan with early payoff.
 * Pay EMI for payoffYears, then lump-sum remaining INR balance at that month's FX rate.
 */
function calcIndianLoanTotalCostUSD(principalUSD, annualRate, termYears, payoffYears, params) {
    if (principalUSD <= 0) return 0;
    const result = calcIndianLoan(principalUSD, annualRate, termYears, params);
    payoffYears = Math.min(payoffYears || termYears, termYears);
    if (payoffYears >= termYears) {
        return result.effectiveTotalUSD;
    }
    const payoffMonth = payoffYears * 12;
    const depRate = params.depreciation / 100;
    const fxRate = params.fxRate;

    // Sum monthly USD-equivalent payments for payoff period
    let totalRepaymentUSD = 0;
    for (let i = 0; i < payoffMonth && i < result.monthlyPaymentsUSD.length; i++) {
        totalRepaymentUSD += result.monthlyPaymentsUSD[i];
    }

    // Lump-sum remaining INR balance converted to USD at payoff month's rate
    if (payoffMonth > 0 && payoffMonth <= result.schedule.length) {
        const remainingINR = result.schedule[payoffMonth - 1].balance;
        const fxRateAtPayoff = fxRate * Math.pow(1 + depRate, payoffMonth / 12);
        totalRepaymentUSD += remainingINR / fxRateAtPayoff;
    }

    return totalRepaymentUSD + result.disbursementCostUSD + result.tcsUSD;
}

/**
 * Find the Indian loan interest rate where total cost equals US loan cost.
 * Uses bisection method. Supports early payoff scenario.
 * Returns null if no crossover in [low, high] range.
 */
function calcBreakevenRate(principalUSD, usRate, usTerm, indiaParams, usPayoffYears, indiaPayoffYears) {
    const usTotal = calcUSLoanTotalCost(principalUSD, usRate, usTerm, usPayoffYears);

    const low = 1;
    const high = 25;

    // Check if crossover exists
    const costAtLow = calcIndianLoanTotalCostUSD(principalUSD, low, indiaParams.term, indiaPayoffYears, indiaParams);
    const costAtHigh = calcIndianLoanTotalCostUSD(principalUSD, high, indiaParams.term, indiaPayoffYears, indiaParams);

    if (costAtLow >= usTotal) return { rate: null, message: 'Indian loan is always more expensive in this range.' };
    if (costAtHigh <= usTotal) return { rate: null, message: 'Indian loan is always cheaper in this range.' };

    // Bisection
    let lo = low, hi = high;
    for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        const cost = calcIndianLoanTotalCostUSD(principalUSD, mid, indiaParams.term, indiaPayoffYears, indiaParams);
        if (cost < usTotal) {
            lo = mid;
        } else {
            hi = mid;
        }
        if (Math.abs(hi - lo) < 0.0001) break;
    }

    return { rate: (lo + hi) / 2, message: null };
}

/**
 * Generate breakeven chart data: sweep Indian rate from min to max.
 * Supports separate early payoff for US and Indian loans.
 */
function calcBreakevenChartData(principalUSD, usRate, usTerm, indiaParams, depRates, usPayoffYears, indiaPayoffYears) {
    const usTotal = calcUSLoanTotalCost(principalUSD, usRate, usTerm, usPayoffYears);
    const ratePoints = [];
    for (let r = 4; r <= 15; r += 0.25) {
        ratePoints.push(r);
    }

    const datasets = depRates.map(dep => {
        const params = { ...indiaParams, depreciation: dep };
        const costs = ratePoints.map(r =>
            calcIndianLoanTotalCostUSD(principalUSD, r, indiaParams.term, indiaPayoffYears, params)
        );
        return { depreciation: dep, costs };
    });

    return {
        ratePoints,
        usTotal,
        datasets,
    };
}

/**
 * Calculate federal income tax.
 */
function calcFederalTax(grossIncome, filingStatus) {
    const deduction = FEDERAL_TAX.standardDeduction[filingStatus] || FEDERAL_TAX.standardDeduction.single;
    const taxable = Math.max(grossIncome - deduction, 0);
    const brackets = FEDERAL_TAX.brackets;

    let tax = 0;
    let prev = 0;
    for (const bracket of brackets) {
        const taxableInBracket = Math.min(taxable, bracket.limit) - prev;
        if (taxableInBracket <= 0) break;
        tax += taxableInBracket * bracket.rate;
        prev = bracket.limit;
    }
    return tax;
}

/**
 * Calculate FICA taxes (Social Security + Medicare).
 */
function calcFICA(grossIncome) {
    const { ssRate, ssCap, medicareRate, additionalMedicareRate, additionalMedicareThreshold } = FEDERAL_TAX.fica;
    const ss = Math.min(grossIncome, ssCap) * ssRate;
    const medicare = grossIncome * medicareRate;
    const additionalMedicare = Math.max(grossIncome - additionalMedicareThreshold, 0) * additionalMedicareRate;
    return ss + medicare + additionalMedicare;
}

/**
 * Calculate total post-tax income.
 */
function calcPostTax(grossAnnual, filingStatus) {
    const federal = calcFederalTax(grossAnnual, filingStatus);
    const fica = calcFICA(grossAnnual);
    const state = grossAnnual * STATE_TAX.illinois.rate;
    const totalTax = federal + fica + state;
    return {
        federal,
        fica,
        state,
        totalTax,
        netAnnual: grossAnnual - totalTax,
        netMonthly: (grossAnnual - totalTax) / 12,
    };
}

/**
 * Simulate loan payoff timeline month by month.
 *
 * For Indian loans: the monthly payment is in USD-equivalent (already FX-adjusted).
 * For US loans: standard fixed monthly payment.
 */
function calcPayoffTimeline(params) {
    const {
        loanBalance,
        annualLoanRate,
        salary,
        salaryGrowth,
        monthlyLiving,
        extraPayment,
        filingStatus,
        isIndianLoan,
        fxRate,
        depreciation,
    } = params;

    const timeline = [];
    let balance = loanBalance;
    let currentSalary = salary;
    let cumulativePaid = 0;
    let cumulativeInterest = 0;
    const monthlyRate = annualLoanRate / 100 / 12;

    for (let month = 1; month <= 360; month++) {
        // Annual salary raise
        if (month > 1 && (month - 1) % 12 === 0) {
            currentSalary *= (1 + salaryGrowth / 100);
        }

        const tax = calcPostTax(currentSalary, filingStatus);
        const disposable = tax.netMonthly - monthlyLiving;

        // Interest accrual
        let interestThisMonth;
        if (isIndianLoan) {
            // For Indian loan: interest accrues in INR, convert to USD
            const fxRateAtMonth = fxRate * Math.pow(1 + depreciation / 100, month / 12);
            const balanceINR = balance * fxRate; // approximate
            const interestINR = balanceINR * monthlyRate;
            interestThisMonth = interestINR / fxRateAtMonth;
        } else {
            interestThisMonth = balance * monthlyRate;
        }

        // Payment: use all disposable income + extra toward the loan
        // Cap at balance + interest (don't overpay), floor at 0 (can't pay negative)
        const affordable = Math.max(disposable + extraPayment, 0);
        const payment = Math.min(affordable, balance + interestThisMonth);

        const principalPortion = payment - interestThisMonth;
        balance = Math.max(balance - principalPortion, 0);
        cumulativePaid += payment;
        cumulativeInterest += interestThisMonth;

        // If payment doesn't cover interest, balance grows
        const balanceGrowing = payment < interestThisMonth;

        timeline.push({
            month,
            year: Math.ceil(month / 12),
            salary: currentSalary,
            payment,
            interest: interestThisMonth,
            principal: principalPortion,
            balance,
            cumulativePaid,
            cumulativeInterest,
            netWorth: -balance,
            disposable,
            warning: balanceGrowing ? 'Balance growing' : null,
        });

        if (balance <= 0.01) break;
    }

    const payoffMonth = timeline.length;
    const paidOff = balance <= 0.01;

    // Continue 24 months past payoff to show savings accumulation in net worth chart
    if (paidOff) {
        let savings = 0;
        for (let m = 1; m <= 24; m++) {
            const month = payoffMonth + m;
            if ((month - 1) % 12 === 0) {
                currentSalary *= (1 + salaryGrowth / 100);
            }
            const tax = calcPostTax(currentSalary, filingStatus);
            const disposable = tax.netMonthly - monthlyLiving;
            savings += Math.max(disposable, 0);
            timeline.push({
                month,
                year: Math.ceil(month / 12),
                salary: currentSalary,
                payment: 0,
                interest: 0,
                principal: 0,
                balance: 0,
                cumulativePaid,
                cumulativeInterest,
                netWorth: savings,
                disposable,
                warning: null,
            });
        }
    }

    const totalPaid = cumulativePaid;
    const totalInterest = cumulativeInterest;

    return { timeline, totalMonths: payoffMonth, totalPaid, totalInterest, paidOff };
}

/**
 * Run payoff simulation at multiple salary levels for sensitivity analysis.
 */
function calcSalarySensitivity(baseSalary, otherParams) {
    const offsets = [-40000, -20000, 0, 20000, 40000];
    return offsets.map(offset => {
        const salary = Math.max(baseSalary + offset, 50000);
        const result = calcPayoffTimeline({ ...otherParams, salary });
        return {
            salary,
            offset,
            totalMonths: result.totalMonths,
            totalPaid: result.totalPaid,
            paidOff: result.paidOff,
            timeline: result.timeline,
        };
    });
}

/**
 * Generate annual cash flow projection from payoff timeline.
 */
function calcAnnualCashFlow(timeline, startingSalary, salaryGrowth, monthlyLiving, filingStatus) {
    const years = {};

    for (const entry of timeline) {
        const yr = entry.year;
        if (!years[yr]) {
            const salary = startingSalary * Math.pow(1 + salaryGrowth / 100, yr - 1);
            const tax = calcPostTax(salary, filingStatus);
            years[yr] = {
                year: yr,
                grossIncome: salary,
                totalTax: tax.totalTax,
                livingExpenses: monthlyLiving * 12,
                loanPayments: 0,
                balance: 0,
            };
        }
        years[yr].loanPayments += entry.payment;
        years[yr].balance = entry.balance;
    }

    return Object.values(years);
}
