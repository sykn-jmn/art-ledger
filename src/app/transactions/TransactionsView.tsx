"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useDb } from "@/components/providers/DbProvider";
import { Badge, Button, Card, Input, Select } from "@/components/ui/primitives";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  TransactionPanel,
  type PanelMode,
} from "@/components/transactions/TransactionPanel";
import { QuickEntry } from "@/components/transactions/QuickEntry";
import { BulkPhpValuationPanel } from "@/components/transactions/BulkPhpValuationPanel";
import {
  bulkApplyPhpValuation,
  createConversion,
  createExpense,
  createIncome,
  deleteConversion,
  deleteExpense,
  deleteIncome,
} from "@/db/transactions";
import { formatDisplayDate, inYearQuarter } from "@/lib/utils/dates";
import { add, formatMoney } from "@/lib/utils/money";
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type CurrencyCode,
  type TransactionType,
} from "@/types";

type ViewMode = "list" | "quick";

type UnifiedRow = {
  id: string;
  type: TransactionType;
  date: string;
  reference: string;
  name: string;
  description: string;
  amountLabel: string;
  feesLabel: string;
  netLabel: string;
  currency: string;
  paymentMethod?: string;
  category?: string;
  needsReview: boolean;
  reviewReasons?: string[];
  phpTaxValuation?: string | null;
  phpValuationRate?: string | null;
  phpValuationSource?: string | null;
};

export default function TransactionsPage() {
  const searchParams = useSearchParams();
  const { ready, settings, incomes, expenses, conversions, fees } = useDb();
  const [view, setView] = useState<ViewMode>("list");
  const [panel, setPanel] = useState<PanelMode | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [selected, setSelected] = useState<UnifiedRow | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const year = settings?.selectedYear ?? new Date().getFullYear();
  const quarter = settings?.selectedQuarter ?? "all";

  useEffect(() => {
    const neu = searchParams.get("new");
    if (neu === "income" || neu === "expense" || neu === "conversion") {
      setPanel({ kind: "create", type: neu });
    }
    if (searchParams.get("needsReview") === "1") setNeedsReviewOnly(true);
    if (searchParams.get("view") === "quick") setView("quick");
  }, [searchParams]);

  const rows = useMemo(() => {
    const list: UnifiedRow[] = [];

    for (const i of incomes) {
      if (!inYearQuarter(i.paymentDate, year, quarter)) continue;
      const rowFees = fees.filter((f) => f.transactionId === i.id);
      const feeSum = rowFees.reduce((s, f) => add(s, f.amount), "0.00");
      list.push({
        id: i.id,
        type: "income",
        date: i.paymentDate,
        reference: i.orderNumber,
        name: i.clientName,
        description: i.description,
        amountLabel: formatMoney(i.grossAmount, i.currency),
        feesLabel: formatMoney(feeSum, i.currency),
        netLabel: formatMoney(i.netReceived, i.currency),
        currency: i.currency,
        paymentMethod: i.paymentMethod,
        needsReview: i.needsReview,
        reviewReasons: i.reviewReasons,
        phpTaxValuation: i.phpTaxValuation,
        phpValuationRate: i.phpValuationRate,
        phpValuationSource: i.phpValuationSource,
      });
    }

    for (const e of expenses) {
      if (!inYearQuarter(e.paymentDate, year, quarter)) continue;
      list.push({
        id: e.id,
        type: "expense",
        date: e.paymentDate,
        reference: e.referenceNumber ?? "—",
        name: e.payee,
        description: e.description,
        amountLabel: formatMoney(e.amount, e.currency),
        feesLabel: "—",
        netLabel: formatMoney(e.amount, e.currency),
        currency: e.currency,
        paymentMethod: e.paymentMethod,
        category: e.category,
        needsReview: false,
      });
    }

    for (const c of conversions) {
      if (!inYearQuarter(c.conversionDate, year, quarter)) continue;
      list.push({
        id: c.id,
        type: "conversion",
        date: c.conversionDate,
        reference: c.referenceNumber ?? "—",
        name: `${c.sourceCurrency} → ${c.destinationCurrency}`,
        description: `Rate ${c.exchangeRate}`,
        amountLabel: `${formatMoney(c.sourceAmount, c.sourceCurrency)} → ${formatMoney(c.destinationAmount, c.destinationCurrency)}`,
        feesLabel: formatMoney(c.conversionFee, c.conversionFeeCurrency),
        netLabel: formatMoney(c.destinationAmount, c.destinationCurrency),
        currency: c.sourceCurrency,
        needsReview: c.needsReview,
      });
    }

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [incomes, expenses, conversions, fees, year, quarter]);

  const filtered = rows.filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (currencyFilter !== "all" && r.currency !== currencyFilter) return false;
    if (methodFilter !== "all" && r.paymentMethod !== methodFilter) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (needsReviewOnly && !r.needsReview) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${r.name} ${r.description} ${r.reference}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const selectableIncomeIds = useMemo(
    () =>
      filtered
        .filter((r) => r.type === "income" && r.currency !== "PHP")
        .map((r) => r.id),
    [filtered],
  );

  const checkedForeignIncomes = useMemo(
    () =>
      incomes.filter(
        (i) => checkedIds.has(i.id) && i.currency !== "PHP",
      ),
    [incomes, checkedIds],
  );

  const allSelectableChecked =
    selectableIncomeIds.length > 0 &&
    selectableIncomeIds.every((id) => checkedIds.has(id));

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setCheckedIds((prev) => {
      if (allSelectableChecked) {
        const next = new Set(prev);
        for (const id of selectableIncomeIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of selectableIncomeIds) next.add(id);
      return next;
    });
  };

  const openEdit = (row: UnifiedRow) => {
    if (row.type === "income") {
      const record = incomes.find((i) => i.id === row.id);
      if (record) setPanel({ kind: "edit", type: "income", record });
    } else if (row.type === "expense") {
      const record = expenses.find((e) => e.id === row.id);
      if (record) setPanel({ kind: "edit", type: "expense", record });
    } else {
      const record = conversions.find((c) => c.id === row.id);
      if (record) setPanel({ kind: "edit", type: "conversion", record });
    }
  };

  const handleDelete = async (row: UnifiedRow) => {
    if (!confirm("Delete this transaction? Income order numbers are not reused.")) {
      return;
    }
    if (row.type === "income") await deleteIncome(row.id);
    else if (row.type === "expense") await deleteExpense(row.id);
    else await deleteConversion(row.id);
    setSelected(null);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(row.id);
      return next;
    });
  };

  const handleDuplicate = async (row: UnifiedRow) => {
    if (row.type === "income") {
      const record = incomes.find((i) => i.id === row.id);
      if (!record) return;
      await createIncome({
        paymentDate: record.paymentDate,
        clientName: record.clientName,
        description: record.description,
        currency: record.currency,
        grossAmount: record.grossAmount,
        paymentMethod: record.paymentMethod,
        phpTaxValuation: record.phpTaxValuation ?? undefined,
        phpValuationRate: record.phpValuationRate ?? undefined,
        phpValuationSource: record.phpValuationSource ?? undefined,
      });
    } else if (row.type === "expense") {
      const record = expenses.find((e) => e.id === row.id);
      if (!record) return;
      await createExpense({
        paymentDate: record.paymentDate,
        payee: record.payee,
        description: record.description,
        category: record.category,
        currency: record.currency,
        amount: record.amount,
        paymentMethod: record.paymentMethod,
        referenceNumber: record.referenceNumber ?? undefined,
      });
    } else {
      const record = conversions.find((c) => c.id === row.id);
      if (!record) return;
      await createConversion({
        conversionDate: record.conversionDate,
        sourceCurrency: record.sourceCurrency,
        sourceAmount: record.sourceAmount,
        destinationCurrency: record.destinationCurrency,
        destinationAmount: record.destinationAmount,
        exchangeRate: record.exchangeRate,
        conversionFee: record.conversionFee,
        conversionFeeCurrency: record.conversionFeeCurrency,
        feeTreatment: record.feeTreatment,
        referenceNumber: record.referenceNumber ?? undefined,
      });
    }
  };

  const handleBulkApply = async (
    ratesByCurrency: Partial<Record<CurrencyCode, string>>,
  ) => {
    const ids = checkedForeignIncomes.map((i) => i.id);
    await bulkApplyPhpValuation({ incomeIds: ids, ratesByCurrency });
    setBulkOpen(false);
    setCheckedIds(new Set());
  };

  if (!ready) return <p>Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <SectionHeading
            as="h1"
            className="text-[24px] font-bold tracking-tight"
            info="Record and manage income, expenses, and currency conversions for the selected year and quarter. Select foreign income rows to bulk-apply a PHP exchange rate. List View supports search and filters; Quick Entry is for pasting or typing many rows at once."
          >
            Transactions
          </SectionHeading>
          <p className="text-[12px] text-on-surface-variant font-mono">
            {filtered.length} shown · {year}
            {quarter === "all" ? "" : ` Q${quarter}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex p-0.5 rounded bg-surface-container">
            <button
              type="button"
              className={`px-3 py-1.5 rounded text-[12px] ${
                view === "list"
                  ? "bg-surface-container-lowest text-primary font-semibold shadow-sm"
                  : "text-on-surface-variant"
              }`}
              onClick={() => setView("list")}
            >
              List View
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded text-[12px] ${
                view === "quick"
                  ? "bg-surface-container-lowest text-primary font-semibold shadow-sm"
                  : "text-on-surface-variant"
              }`}
              onClick={() => setView("quick")}
            >
              Quick Entry
            </button>
          </div>
          <Button
            className="inline-flex items-center gap-1"
            onClick={() => setPanel({ kind: "create", type: "income" })}
          >
            <Plus size={14} /> Add Transaction
          </Button>
        </div>
      </div>

      {view === "quick" ? (
        <QuickEntry />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              className="!w-56 max-w-full"
              placeholder="Search name, description, ref…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              className="!w-auto min-w-[9rem]"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="conversion">Conversion</option>
            </Select>
            <Select
              className="!w-auto min-w-[9rem]"
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
            >
              <option value="all">All currencies</option>
              <option value="USD">USD</option>
              <option value="PHP">PHP</option>
              <option value="EUR">EUR</option>
            </Select>
            <Select
              className="!w-auto min-w-[11rem]"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="all">All methods</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Select
              className="!w-auto min-w-[11rem]"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-[12px] text-on-surface-variant whitespace-nowrap">
              <input
                type="checkbox"
                checked={needsReviewOnly}
                onChange={(e) => setNeedsReviewOnly(e.target.checked)}
              />
              Needs review
            </label>
          </div>

          {checkedForeignIncomes.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary-fixed/25 px-3 py-2">
              <p className="text-[12px] text-on-surface">
                <span className="font-semibold">
                  {checkedForeignIncomes.length}
                </span>{" "}
                foreign income selected — enter an exchange rate to calculate PHP
                tax valuations.
              </p>
              <Button type="button" onClick={() => setBulkOpen(true)}>
                Set PHP valuation
              </Button>
            </div>
          ) : null}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[940px]">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider text-outline">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all foreign income"
                        checked={allSelectableChecked}
                        disabled={selectableIncomeIds.length === 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2">Name / Description</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Fees</th>
                    <th className="px-4 py-2 text-right">Net</th>
                    <th className="px-4 py-2 w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-on-surface-variant"
                      >
                        No transactions yet. Add income, expenses, or conversions.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => {
                      const canSelect =
                        row.type === "income" && row.currency !== "PHP";
                      return (
                        <tr
                          key={`${row.type}-${row.id}`}
                          className="border-t border-outline-variant/20 hover:bg-surface-container-low/50 cursor-pointer"
                          onClick={() => setSelected(row)}
                        >
                          <td
                            className="px-3 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canSelect ? (
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.reference}`}
                                checked={checkedIds.has(row.id)}
                                onChange={() => toggleChecked(row.id)}
                              />
                            ) : (
                              <span className="inline-block w-4" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[12px]">
                            {formatDisplayDate(row.date)}
                          </td>
                          <td className="px-4 py-2.5 capitalize">
                            <Badge
                              tone={
                                row.type === "income"
                                  ? "primary"
                                  : row.type === "expense"
                                    ? "neutral"
                                    : "success"
                              }
                            >
                              {row.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[12px] text-primary">
                            {row.reference}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{row.name}</div>
                            <div className="text-[12px] text-on-surface-variant truncate max-w-md">
                              {row.description}
                            </div>
                            {row.needsReview ? (
                              <Badge tone="warn">Needs review</Badge>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[12px]">
                            {row.amountLabel}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[12px]">
                            {row.feesLabel}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[12px] font-semibold text-primary">
                            {row.netLabel}
                          </td>
                          <td className="px-4 py-2.5">
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-surface-container"
                                aria-label="Edit"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-surface-container"
                                aria-label="Duplicate"
                                onClick={() => handleDuplicate(row)}
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-error-container text-outline hover:text-error"
                                aria-label="Delete"
                                onClick={() => handleDelete(row)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {selected ? (
        <>
          <div
            className="fixed inset-0 top-14 left-0 lg:left-60 bg-inverse-surface/25 z-30"
            onClick={() => setSelected(null)}
          />
          <aside className="fixed top-14 right-0 bottom-0 w-full max-w-[420px] bg-surface-container-lowest shadow-2xl z-40 p-6 overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-[18px] font-semibold capitalize">
                  {selected.type} details
                </h2>
                <p className="font-mono text-[11px] text-outline">
                  {formatDisplayDate(selected.date)} · {selected.reference}
                </p>
              </div>
              <button
                type="button"
                className="text-outline"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <dl className="flex flex-col gap-3 text-[13px]">
              <div>
                <dt className="text-[11px] uppercase text-outline">Name</dt>
                <dd>{selected.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-outline">Description</dt>
                <dd>{selected.description}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-outline">Amount</dt>
                <dd className="font-mono">{selected.amountLabel}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-outline">Fees</dt>
                <dd className="font-mono">{selected.feesLabel}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase text-outline">Net</dt>
                <dd className="font-mono font-semibold text-primary">
                  {selected.netLabel}
                </dd>
              </div>
              {selected.type === "income" && selected.currency !== "PHP" ? (
                <>
                  <div>
                    <dt className="text-[11px] uppercase text-outline">
                      PHP Tax Valuation
                    </dt>
                    <dd className="font-mono">
                      {selected.phpTaxValuation
                        ? formatMoney(selected.phpTaxValuation, "PHP")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase text-outline">
                      Valuation Rate / Source
                    </dt>
                    <dd className="text-[12px]">
                      {selected.phpValuationRate
                        ? `Rate ${selected.phpValuationRate}`
                        : null}
                      {selected.phpValuationRate && selected.phpValuationSource
                        ? " · "
                        : null}
                      {selected.phpValuationSource ??
                        (selected.phpValuationRate ? null : "—")}
                    </dd>
                  </div>
                </>
              ) : null}
              {selected.needsReview && selected.reviewReasons?.length ? (
                <div>
                  <dt className="text-[11px] uppercase text-outline">Review</dt>
                  <dd className="text-[12px] text-error">
                    {selected.reviewReasons.join(" · ")}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="flex gap-2 mt-6">
              <Button onClick={() => openEdit(selected)}>Edit</Button>
              <Button variant="secondary" onClick={() => handleDuplicate(selected)}>
                Duplicate
              </Button>
              <Button variant="danger" onClick={() => handleDelete(selected)}>
                Delete
              </Button>
            </div>
          </aside>
        </>
      ) : null}

      {bulkOpen ? (
        <>
          <div
            className="fixed inset-0 top-14 left-0 lg:left-60 bg-inverse-surface/25 z-40"
            onClick={() => setBulkOpen(false)}
          />
          <aside className="fixed top-14 right-0 bottom-0 w-full max-w-[440px] bg-surface-container-lowest shadow-2xl z-50 p-6 overflow-y-auto">
            <BulkPhpValuationPanel
              incomes={checkedForeignIncomes}
              onApply={handleBulkApply}
              onCancel={() => setBulkOpen(false)}
            />
          </aside>
        </>
      ) : null}

      <TransactionPanel mode={panel} onClose={() => setPanel(null)} />
    </div>
  );
}
