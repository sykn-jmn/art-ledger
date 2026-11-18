import ExcelJS from "exceljs";
import type { CdjEntry, CrjEntry, GlEntry } from "@/lib/calculations/journals";
import type {
  AnnualTaxSummary,
  MonthlyIncomeRow,
  QuarterlyTaxRow,
} from "@/lib/calculations/taxes";
import { formatDisplayDate } from "@/lib/utils/dates";

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E7FF" },
  };
}

export async function exportJournalsXlsx(params: {
  crj: CrjEntry[];
  cdj: CdjEntry[];
  gl: GlEntry[];
  year: number;
  quarter: string;
  sheets: ("CRJ" | "CDJ" | "GL")[];
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ArtLedger";
  wb.created = new Date();

  if (params.sheets.includes("CRJ")) {
    const ws = wb.addWorksheet("CRJ");
    ws.addRow([
      "Date",
      "Particulars",
      "O.R. No.",
      "Service Revenue",
      "Other Account",
      "Amount",
      "Cash",
      "Flags",
    ]);
    styleHeader(ws.getRow(1));
    for (const e of params.crj) {
      ws.addRow([
        formatDisplayDate(e.date),
        e.particulars,
        e.orNumber,
        e.serviceRevenue,
        e.otherAccount,
        e.otherAmount,
        e.cash,
        e.flags.join(", "),
      ]);
    }
    const total = params.crj.reduce(
      (s, e) => s + Number(e.serviceRevenue ?? 0),
      0,
    );
    ws.addRow([]);
    ws.addRow(["", "TOTAL", "", total.toFixed(2), "", "", total.toFixed(2), ""]);
  }

  if (params.sheets.includes("CDJ")) {
    const ws = wb.addWorksheet("CDJ");
    ws.addRow([
      "Date",
      "Particulars",
      "OR No.",
      "Cash",
      "Other Account",
      "Amount",
      "PayPal Fee",
      "VGen Partner Fee",
      "Monthly Revenue Share",
      "Withdrawals",
      "Tools & Brush",
      "Software",
      "Flags",
    ]);
    styleHeader(ws.getRow(1));
    for (const e of params.cdj) {
      ws.addRow([
        formatDisplayDate(e.date),
        e.particulars,
        e.orNumber,
        e.cash,
        e.otherAccount,
        e.otherAmount,
        e.paypalFee,
        e.vgenPartnerFee,
        e.monthlyRevenueShare,
        e.withdrawals,
        e.toolsBrush,
        e.software,
        e.flags.join(", "),
      ]);
    }
  }

  if (params.sheets.includes("GL")) {
    const ws = wb.addWorksheet("GL");
    ws.addRow([
      "Date",
      "Particulars",
      "Journal Ref",
      "Account",
      "Debit",
      "Credit",
      "Flags",
    ]);
    styleHeader(ws.getRow(1));
    for (const e of params.gl) {
      ws.addRow([
        formatDisplayDate(e.date),
        e.particulars,
        e.journalRef,
        e.account,
        e.debit,
        e.credit,
        e.flags.join(", "),
      ]);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const suffix =
    params.sheets.length === 3 ? "all" : params.sheets.join("-").toLowerCase();
  downloadBuffer(
    buffer as ArrayBuffer,
    `artledger-journals-${params.year}-${params.quarter}-${suffix}.xlsx`,
  );
}

export async function exportTaxSummaryXlsx(params: {
  year: number;
  annual: AnnualTaxSummary;
  monthly: MonthlyIncomeRow[];
  quarterly: QuarterlyTaxRow[];
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const overview = wb.addWorksheet("Annual Overview");
  overview.addRow(["Metric", "Amount"]);
  styleHeader(overview.getRow(1));
  overview.addRow(["Gross Income", params.annual.grossIncome]);
  overview.addRow(["Taxable Income", params.annual.taxableIncome]);
  overview.addRow(["Estimated Tax", params.annual.estimatedTax]);
  overview.addRow(["Tax Paid", params.annual.taxPaid]);
  overview.addRow(["Remaining Tax", params.annual.remainingTax]);
  if (params.annual.incomplete) {
    overview.addRow([
      "Warning",
      `${params.annual.missingValuationCount} income(s) missing PHP valuation`,
    ]);
  }

  const monthly = wb.addWorksheet("Monthly Income");
  monthly.addRow(["Month", "Gross Income", "Missing Valuation"]);
  styleHeader(monthly.getRow(1));
  for (const m of params.monthly) {
    monthly.addRow([
      m.monthName,
      m.grossIncomePhp,
      m.hasMissingValuation ? "Yes" : "",
    ]);
  }

  const quarterly = wb.addWorksheet("Quarterly Tax");
  quarterly.addRow([
    "Quarter",
    "Gross Income",
    "Cumulative Income",
    "Cumulative Estimated Tax",
    "Tax Paid",
    "Remaining",
  ]);
  styleHeader(quarterly.getRow(1));
  for (const q of params.quarterly) {
    quarterly.addRow([
      `Q${q.quarter}`,
      q.grossIncome,
      q.cumulativeIncome,
      q.cumulativeEstimatedTax,
      q.taxPaid,
      q.remainingEstimatedTax,
    ]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBuffer(
    buffer as ArrayBuffer,
    `artledger-tax-summary-${params.year}.xlsx`,
  );
}
