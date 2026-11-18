import type { IncomeTransaction, TaxPayment } from "@/types";
import { getMonthIndex, getQuarter, getYear } from "@/lib/utils/dates";
import { add, d, formatMoney, max0, money, mul } from "@/lib/utils/money";

export interface MonthlyIncomeRow {
  monthIndex: number;
  monthName: string;
  grossIncomePhp: string;
  calculatedShare: string;
  hasMissingValuation: boolean;
  missingCount: number;
}

export interface QuarterlyTaxRow {
  quarter: 1 | 2 | 3 | 4;
  grossIncome: string;
  cumulativeIncome: string;
  cumulativeEstimatedTax: string;
  taxPaid: string;
  remainingEstimatedTax: string;
  hasMissingValuation: boolean;
}

export interface AnnualTaxSummary {
  grossIncome: string;
  taxableIncome: string;
  estimatedTax: string;
  taxPaid: string;
  remainingTax: string;
  deduction: string;
  ratePercent: string;
  incomplete: boolean;
  missingValuationCount: number;
}

export function incomePhpGross(income: IncomeTransaction): {
  amount: string;
  missing: boolean;
} {
  if (income.currency === "PHP") {
    return { amount: money(income.grossAmount), missing: false };
  }
  if (income.phpTaxValuation !== null && income.phpTaxValuation !== "") {
    return { amount: money(income.phpTaxValuation), missing: false };
  }
  return { amount: "0.00", missing: true };
}

export function calculateAnnualTax(params: {
  incomes: IncomeTransaction[];
  taxPayments: TaxPayment[];
  year: number;
  deduction?: string;
  ratePercent?: string;
}): AnnualTaxSummary {
  const deduction = params.deduction ?? "250000";
  const ratePercent = params.ratePercent ?? "8";

  let gross = d(0);
  let missing = 0;

  for (const income of params.incomes) {
    if (getYear(income.paymentDate) !== params.year) continue;
    const { amount, missing: m } = incomePhpGross(income);
    if (m) missing += 1;
    else gross = gross.plus(d(amount));
  }

  const grossIncome = money(gross);
  const taxableIncome = max0(d(grossIncome).minus(d(deduction)));
  const estimatedTax = money(d(taxableIncome).times(d(ratePercent)).div(100));

  const taxPaid = money(
    params.taxPayments
      .filter((p) => p.taxYear === params.year)
      .reduce((sum, p) => add(sum, p.amountPaid), "0.00"),
  );

  const remainingTax = max0(d(estimatedTax).minus(d(taxPaid)));

  return {
    grossIncome,
    taxableIncome,
    estimatedTax,
    taxPaid,
    remainingTax,
    deduction: money(deduction),
    ratePercent,
    incomplete: missing > 0,
    missingValuationCount: missing,
  };
}

export function calculateMonthlyIncome(params: {
  incomes: IncomeTransaction[];
  year: number;
  revenueSharePercent: string;
}): MonthlyIncomeRow[] {
  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    let gross = d(0);
    let missingCount = 0;
    for (const income of params.incomes) {
      if (getYear(income.paymentDate) !== params.year) continue;
      if (getMonthIndex(income.paymentDate) !== monthIndex) continue;
      const { amount, missing } = incomePhpGross(income);
      if (missing) missingCount += 1;
      else gross = gross.plus(d(amount));
    }
    const grossIncomePhp = money(gross);
    return {
      monthIndex,
      monthName: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ][monthIndex]!,
      grossIncomePhp,
      calculatedShare: mul(grossIncomePhp, d(params.revenueSharePercent).div(100)),
      hasMissingValuation: missingCount > 0,
      missingCount,
    };
  });
  return months;
}

export function calculateQuarterlyTax(params: {
  incomes: IncomeTransaction[];
  taxPayments: TaxPayment[];
  year: number;
  deduction?: string;
  ratePercent?: string;
}): QuarterlyTaxRow[] {
  const deduction = params.deduction ?? "250000";
  const ratePercent = params.ratePercent ?? "8";

  const quarterGross = [d(0), d(0), d(0), d(0)];
  const quarterMissing = [false, false, false, false];

  for (const income of params.incomes) {
    if (getYear(income.paymentDate) !== params.year) continue;
    const q = getQuarter(income.paymentDate) - 1;
    const { amount, missing } = incomePhpGross(income);
    if (missing) quarterMissing[q] = true;
    else quarterGross[q] = quarterGross[q]!.plus(d(amount));
  }

  let cumulative = d(0);
  return ([1, 2, 3, 4] as const).map((quarter) => {
    const g = quarterGross[quarter - 1]!;
    cumulative = cumulative.plus(g);
    const cumulativeIncome = money(cumulative);
    const taxable = max0(d(cumulativeIncome).minus(d(deduction)));
    const cumulativeEstimatedTax = money(
      d(taxable).times(d(ratePercent)).div(100),
    );

    const periodKey = `Q${quarter}` as TaxPayment["period"];
    const taxPaid = money(
      params.taxPayments
        .filter(
          (p) =>
            p.taxYear === params.year &&
            (p.period === periodKey ||
              (quarter === 4 && p.period === "annual")),
        )
        .reduce((sum, p) => add(sum, p.amountPaid), "0.00"),
    );

    // Remaining uses cumulative tax minus all payments up to this quarter
    const paidToDate = money(
      params.taxPayments
        .filter((p) => {
          if (p.taxYear !== params.year) return false;
          const order = { Q1: 1, Q2: 2, Q3: 3, Q4: 4, annual: 4 };
          return order[p.period] <= quarter;
        })
        .reduce((sum, p) => add(sum, p.amountPaid), "0.00"),
    );

    return {
      quarter,
      grossIncome: money(g),
      cumulativeIncome,
      cumulativeEstimatedTax,
      taxPaid,
      remainingEstimatedTax: max0(d(cumulativeEstimatedTax).minus(d(paidToDate))),
      hasMissingValuation: quarterMissing[quarter - 1]!,
    };
  });
}

export function formatPhp(value: string): string {
  return formatMoney(value, "PHP");
}
