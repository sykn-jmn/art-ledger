import type {
  CurrencyConversion,
  ExpenseCategory,
  ExpenseTransaction,
  FeeRecord,
  IncomeTransaction,
} from "@/types";
import { EXPENSE_CATEGORY_LABELS } from "@/types";
import { getMonthIndex, getQuarter, getYear, inYearQuarter } from "@/lib/utils/dates";
import { add, money } from "@/lib/utils/money";
import { incomePhpGross } from "@/lib/calculations/taxes";

export type JournalFlag = "missing_php_valuation" | "unmapped_conversion" | "unmapped_category";

export interface CrjEntry {
  id: string;
  date: string;
  particulars: string;
  orNumber: string;
  serviceRevenue: string | null;
  otherAccount: string | null;
  otherAmount: string | null;
  cash: string | null;
  flags: JournalFlag[];
  sourceId: string;
}

export interface CdjEntry {
  id: string;
  date: string;
  particulars: string;
  orNumber: string | null;
  cash: string | null;
  otherAccount: string | null;
  otherAmount: string | null;
  paypalFee: string | null;
  vgenPartnerFee: string | null;
  monthlyRevenueShare: string | null;
  withdrawals: string | null;
  toolsBrush: string | null;
  software: string | null;
  flags: JournalFlag[];
  sourceId: string;
  sourceType: "expense" | "income_fees" | "conversion";
}

export interface GlEntry {
  id: string;
  date: string;
  particulars: string;
  journalRef: string;
  account: GlAccount;
  debit: string;
  credit: string;
  sourceId: string;
  flags: JournalFlag[];
}

export type GlAccount =
  | "Cash"
  | "PayPal Fee"
  | "Partner Fee"
  | "Monthly Revenue Share"
  | "Withdrawals"
  | "Service Revenue"
  | "Tools & Brush"
  | "Software"
  | "Other Expense"
  | "Unmapped";

export interface JournalBundle {
  crj: CrjEntry[];
  cdj: CdjEntry[];
  gl: GlEntry[];
  flags: { message: string; sourceId: string; flag: JournalFlag }[];
}

function feeTotal(
  fees: FeeRecord[],
  transactionId: string,
  feeType: FeeRecord["feeType"],
): string {
  return money(
    fees
      .filter((f) => f.transactionId === transactionId && f.feeType === feeType)
      .reduce((s, f) => add(s, f.amount), "0.00"),
  );
}

/**
 * Generate CRJ/CDJ/GL from source records.
 * Does not invent balanced postings for unmapped items — flags them instead.
 */
export function generateJournals(params: {
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  conversions: CurrencyConversion[];
  fees: FeeRecord[];
  year: number;
  quarter: 1 | 2 | 3 | 4 | "all";
}): JournalBundle {
  const { year, quarter } = params;
  const flags: JournalBundle["flags"] = [];
  const crj: CrjEntry[] = [];
  const cdj: CdjEntry[] = [];
  const gl: GlEntry[] = [];

  const inScope = (date: string) => inYearQuarter(date, year, quarter);

  for (const income of params.incomes) {
    if (!inScope(income.paymentDate)) continue;
    const { amount: phpGross, missing } = incomePhpGross(income);
    const entryFlags: JournalFlag[] = [];
    if (missing) {
      entryFlags.push("missing_php_valuation");
      const pendingAuto =
        income.phpValuationAutoPending && Boolean(income.phpTaxValuation);
      flags.push({
        message: pendingAuto
          ? `Income ${income.orderNumber} has an auto-calculated PHP valuation — finalize to include in books`
          : `Income ${income.orderNumber} needs PHP tax valuation`,
        sourceId: income.id,
        flag: "missing_php_valuation",
      });
    }

    const cashPhp = missing ? null : phpGross;
    crj.push({
      id: `crj-${income.id}`,
      date: income.paymentDate,
      particulars: `${income.clientName} — ${income.description}`,
      orNumber: income.orderNumber,
      serviceRevenue: cashPhp,
      otherAccount: null,
      otherAmount: null,
      cash: cashPhp,
      flags: entryFlags,
      sourceId: income.id,
    });

    if (!missing) {
      gl.push({
        id: `gl-rev-${income.id}`,
        date: income.paymentDate,
        particulars: income.clientName,
        journalRef: `CRJ-${income.orderNumber}`,
        account: "Service Revenue",
        debit: "0.00",
        credit: phpGross,
        sourceId: income.id,
        flags: [],
      });
      gl.push({
        id: `gl-cash-in-${income.id}`,
        date: income.paymentDate,
        particulars: income.clientName,
        journalRef: `CRJ-${income.orderNumber}`,
        account: "Cash",
        debit: phpGross,
        credit: "0.00",
        sourceId: income.id,
        flags: [],
      });
    }

    // Provider fees — CDJ memo columns (original currency amounts shown; PHP mapping flagged if needed)
    const paypal = feeTotal(params.fees, income.id, "paypal");
    const vgen = feeTotal(params.fees, income.id, "vgen");
    if (paypal !== "0.00" || vgen !== "0.00") {
      cdj.push({
        id: `cdj-fee-${income.id}`,
        date: income.paymentDate,
        particulars: `Platform fees — ${income.clientName} (#${income.orderNumber})`,
        orNumber: income.orderNumber,
        cash: null,
        otherAccount: null,
        otherAmount: null,
        paypalFee: paypal !== "0.00" ? paypal : null,
        vgenPartnerFee: vgen !== "0.00" ? vgen : null,
        monthlyRevenueShare: null,
        withdrawals: null,
        toolsBrush: null,
        software: null,
        flags: missing ? ["missing_php_valuation"] : [],
        sourceId: income.id,
        sourceType: "income_fees",
      });

      if (!missing && income.currency === "PHP") {
        if (paypal !== "0.00") {
          gl.push({
            id: `gl-pp-${income.id}`,
            date: income.paymentDate,
            particulars: `PayPal fee #${income.orderNumber}`,
            journalRef: `CDJ-${income.orderNumber}`,
            account: "PayPal Fee",
            debit: paypal,
            credit: "0.00",
            sourceId: income.id,
            flags: [],
          });
        }
        if (vgen !== "0.00") {
          gl.push({
            id: `gl-vg-${income.id}`,
            date: income.paymentDate,
            particulars: `Partner fee #${income.orderNumber}`,
            journalRef: `CDJ-${income.orderNumber}`,
            account: "Partner Fee",
            debit: vgen,
            credit: "0.00",
            sourceId: income.id,
            flags: [],
          });
        }
      }
    }
  }

  for (const expense of params.expenses) {
    if (!inScope(expense.paymentDate)) continue;
    if (expense.category === "internal_transfer") {
      flags.push({
        message: `Internal transfer ${expense.id} excluded from expense journals`,
        sourceId: expense.id,
        flag: "unmapped_category",
      });
      continue;
    }

    const entry: CdjEntry = {
      id: `cdj-${expense.id}`,
      date: expense.paymentDate,
      particulars: `${expense.payee} — ${expense.description}`,
      orNumber: expense.referenceNumber,
      cash: expense.amount,
      otherAccount: null,
      otherAmount: null,
      paypalFee: null,
      vgenPartnerFee: null,
      monthlyRevenueShare: null,
      withdrawals: null,
      toolsBrush: null,
      software: null,
      flags: [],
      sourceId: expense.id,
      sourceType: "expense",
    };

    let glAccount: GlAccount = "Other Expense";
    switch (expense.category as ExpenseCategory) {
      case "tools_brushes":
        entry.toolsBrush = expense.amount;
        glAccount = "Tools & Brush";
        break;
      case "software":
        entry.software = expense.amount;
        glAccount = "Software";
        break;
      case "monthly_revenue_share":
        entry.monthlyRevenueShare = expense.amount;
        glAccount = "Monthly Revenue Share";
        break;
      case "owners_drawings":
        entry.withdrawals = expense.amount;
        glAccount = "Withdrawals";
        break;
      case "other_business":
      case "other_disbursements":
        entry.otherAccount = EXPENSE_CATEGORY_LABELS[expense.category];
        entry.otherAmount = expense.amount;
        glAccount = "Other Expense";
        break;
    }

    cdj.push(entry);

    if (expense.currency === "PHP") {
      gl.push({
        id: `gl-exp-${expense.id}`,
        date: expense.paymentDate,
        particulars: expense.payee,
        journalRef: `CDJ-${expense.referenceNumber ?? expense.id.slice(0, 8)}`,
        account: glAccount,
        debit: expense.amount,
        credit: "0.00",
        sourceId: expense.id,
        flags: [],
      });
      gl.push({
        id: `gl-exp-cash-${expense.id}`,
        date: expense.paymentDate,
        particulars: expense.payee,
        journalRef: `CDJ-${expense.referenceNumber ?? expense.id.slice(0, 8)}`,
        account: "Cash",
        debit: "0.00",
        credit: expense.amount,
        sourceId: expense.id,
        flags: [],
      });
    } else {
      entry.flags.push("unmapped_category");
      flags.push({
        message: `Expense in ${expense.currency} needs PHP mapping for GL`,
        sourceId: expense.id,
        flag: "unmapped_category",
      });
    }
  }

  for (const conv of params.conversions) {
    if (!inScope(conv.conversionDate)) continue;
    // Currency conversions are not auto-posted — flag for review
    flags.push({
      message: `Conversion ${conv.sourceCurrency}→${conv.destinationCurrency} needs account mapping review`,
      sourceId: conv.id,
      flag: "unmapped_conversion",
    });
    cdj.push({
      id: `cdj-conv-${conv.id}`,
      date: conv.conversionDate,
      particulars: `FX conversion ${conv.sourceAmount} ${conv.sourceCurrency} → ${conv.destinationAmount} ${conv.destinationCurrency} (review)`,
      orNumber: conv.referenceNumber,
      cash: null,
      otherAccount: "FX Conversion (unmapped)",
      otherAmount: conv.sourceAmount,
      paypalFee: null,
      vgenPartnerFee: null,
      monthlyRevenueShare: null,
      withdrawals: null,
      toolsBrush: null,
      software: null,
      flags: ["unmapped_conversion"],
      sourceId: conv.id,
      sourceType: "conversion",
    });
  }

  const byDate = <T extends { date: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return {
    crj: byDate(crj),
    cdj: byDate(cdj),
    gl: byDate(gl),
    flags,
  };
}

export function journalMonthlyTotals(
  entries: { date: string; amount: string | null }[],
  year: number,
): { month: number; total: string }[] {
  return Array.from({ length: 12 }, (_, month) => {
    const total = entries
      .filter(
        (e) => getYear(e.date) === year && getMonthIndex(e.date) === month && e.amount,
      )
      .reduce((s, e) => add(s, e.amount ?? "0"), "0.00");
    return { month, total: money(total) };
  });
}

export function journalQuarterTotal(
  entries: { date: string; amount: string | null }[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
): string {
  return money(
    entries
      .filter(
        (e) =>
          getYear(e.date) === year &&
          getQuarter(e.date) === quarter &&
          e.amount,
      )
      .reduce((s, e) => add(s, e.amount ?? "0"), "0.00"),
  );
}
