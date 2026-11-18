"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { v4 as uuid } from "uuid";
import { Badge, Button, Input, Select } from "@/components/ui/primitives";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useDb } from "@/components/providers/DbProvider";
import {
  createConversion,
  createExpense,
  createIncome,
} from "@/db/transactions";
import { calculateIncomeFees } from "@/lib/calculations/fees";
import { formatOrderNumber } from "@/lib/utils/order-number";
import { money } from "@/lib/utils/money";
import { todayISO } from "@/lib/utils/dates";
import {
  CURRENCIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
  type PaymentMethod,
  type TransactionType,
} from "@/types";

interface Row {
  tempId: string;
  type: TransactionType;
  date: string;
  name: string;
  description: string;
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  category: ExpenseCategory;
  fees: string;
  referenceNumber: string;
  destinationCurrency: string;
  destinationAmount: string;
  conversionFee: string;
  phpTaxValuation: string;
  status?: "ok" | "error" | "saved";
  message?: string;
}

function emptyRow(defaults?: Partial<Row>): Row {
  return {
    tempId: uuid(),
    type: "income",
    date: todayISO(),
    name: "",
    description: "",
    amount: "",
    currency: "USD",
    paymentMethod: "vgen_paypal",
    category: "tools_brushes",
    fees: "",
    referenceNumber: "",
    destinationCurrency: "PHP",
    destinationAmount: "",
    conversionFee: "0",
    phpTaxValuation: "",
    ...defaults,
  };
}

export function QuickEntry() {
  const { settings, incomes } = useDb();
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const suggestedOrders = useMemo(() => {
    const used = new Set(incomes.map((i) => i.orderNumber));
    let next = settings?.nextOrderNumber ?? 1;
    const suggestions: string[] = [];
    const incomeCount = rows.filter((r) => r.type === "income").length;
    while (suggestions.length < incomeCount) {
      const cand = formatOrderNumber(next);
      if (!used.has(cand) && !suggestions.includes(cand)) suggestions.push(cand);
      next += 1;
    }
    return suggestions;
  }, [rows, incomes, settings?.nextOrderNumber]);

  const updateRow = (tempId: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.tempId !== tempId) return r;
        const next = { ...r, ...patch, status: undefined, message: undefined };
        if (
          next.type === "income" &&
          (patch.amount !== undefined ||
            patch.paymentMethod !== undefined ||
            patch.currency !== undefined)
        ) {
          try {
            if (next.amount) {
              const fees = calculateIncomeFees({
                grossAmount: money(next.amount),
                currency: next.currency as Row["currency"] & "USD",
                paymentMethod: next.paymentMethod,
                rules: settings?.feeRules,
              });
              next.fees = fees.totalFees;
            }
          } catch {
            /* ignore preview errors */
          }
        }
        return next;
      }),
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (tempId: string) =>
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const lines = text
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split("\t"));
    const pasted: Row[] = lines.map((cols) => {
      const type = (cols[1]?.toLowerCase() as TransactionType) || "income";
      return emptyRow({
        date: cols[0] || todayISO(),
        type: ["income", "expense", "conversion"].includes(type)
          ? type
          : "income",
        name: cols[2] || "",
        description: cols[3] || "",
        amount: cols[4] || "",
        currency: (cols[5] as Row["currency"]) || "USD",
        paymentMethod:
          (cols[6] as PaymentMethod) ||
          ("vgen_paypal" as PaymentMethod),
        referenceNumber: cols[7] || "",
      });
    });
    if (pasted.length) setRows((prev) => [...prev.filter((r) => r.name || r.amount), ...pasted]);
  };

  const detectDuplicates = (row: Row) =>
    incomes.some(
      (i) =>
        i.paymentDate === row.date &&
        i.clientName.toLowerCase() === row.name.toLowerCase() &&
        i.grossAmount === money(row.amount || "0") &&
        i.currency === row.currency,
    );

  const saveAll = async () => {
    setBusy(true);
    setSummary(null);
    const nextRows = [...rows];
    let saved = 0;
    let incomeHint = 0;

    for (let i = 0; i < nextRows.length; i++) {
      const row = nextRows[i]!;
      if (!row.name && !row.amount && !row.description) {
        nextRows[i] = { ...row, status: "ok", message: "Empty — skipped" };
        continue;
      }
      if (!row.date || !row.name || !row.description || !row.amount) {
        nextRows[i] = {
          ...row,
          status: "error",
          message: "Incomplete row",
        };
        continue;
      }

      try {
        if (row.type === "income") {
          await createIncome({
            paymentDate: row.date,
            clientName: row.name,
            description: row.description,
            currency: row.currency as "USD",
            grossAmount: row.amount,
            paymentMethod: row.paymentMethod,
            phpTaxValuation: row.phpTaxValuation || undefined,
            orderNumberOverride: suggestedOrders[incomeHint],
          });
          incomeHint += 1;
        } else if (row.type === "expense") {
          await createExpense({
            paymentDate: row.date,
            payee: row.name,
            description: row.description,
            category: row.category,
            currency: row.currency as "USD",
            amount: row.amount,
            paymentMethod: row.paymentMethod,
            referenceNumber: row.referenceNumber,
          });
        } else {
          if (!row.destinationAmount) {
            nextRows[i] = {
              ...row,
              status: "error",
              message: "Destination amount required",
            };
            continue;
          }
          await createConversion({
            conversionDate: row.date,
            sourceCurrency: row.currency as "USD",
            sourceAmount: row.amount,
            destinationCurrency: row.destinationCurrency as "PHP",
            destinationAmount: row.destinationAmount,
            conversionFee: row.conversionFee || "0",
            conversionFeeCurrency: row.currency as "USD",
            feeTreatment: "from_source",
            referenceNumber: row.referenceNumber,
          });
        }
        nextRows[i] = { ...row, status: "saved", message: "Saved" };
        saved += 1;
      } catch (err) {
        nextRows[i] = {
          ...row,
          status: "error",
          message: err instanceof Error ? err.message : "Failed",
        };
      }
    }

    setRows(nextRows.filter((r) => r.status !== "saved"));
    if (nextRows.every((r) => r.status === "saved" || r.message === "Empty — skipped")) {
      setRows([emptyRow(), emptyRow()]);
    }
    setSummary(`Saved ${saved} row(s). Failed rows remain for correction.`);
    setBusy(false);
  };

  let incomeIdx = 0;

  return (
    <div className="flex flex-col gap-3" onPaste={handlePaste}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <SectionHeading info="Enter or paste many income, expense, and conversion rows at once (date, type, name, description, amount, currency, and related fields). Fees and order numbers fill automatically when you bulk save. Foreign income without a PHP valuation is auto-filled via Frankfurter and stays Needs review until you Finalize it. Failed rows stay in the grid so you can fix and retry.">
            Spreadsheet Quick-Entry
          </SectionHeading>
          <p className="text-[12px] text-on-surface-variant">
            Paste from Excel (date, type, name, description, amount, currency…). Fees,
            order numbers, and missing PHP valuations fill automatically (auto
            valuations need Finalize).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={addRow}>
            <span className="inline-flex items-center gap-1">
              <Plus size={14} /> Add row
            </span>
          </Button>
          <Button type="button" disabled={busy} onClick={saveAll}>
            Bulk Save
          </Button>
        </div>
      </div>

      {summary ? (
        <p className="text-[12px] bg-surface-container-low rounded px-3 py-2">
          {summary}
        </p>
      ) : null}

      <div className="overflow-x-auto bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/30">
        <table className="w-full min-w-[1100px] text-left text-[12px]">
          <thead>
            <tr className="bg-surface-container-low text-outline uppercase tracking-wider text-[11px]">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2">Amount</th>
              <th className="px-2 py-2">Currency</th>
              <th className="px-2 py-2">Method / Category</th>
              <th className="px-2 py-2">Fees / Dest</th>
              <th className="px-2 py-2">Ref / Order</th>
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const orderHint =
                row.type === "income"
                  ? suggestedOrders[incomeIdx++]
                  : row.referenceNumber;
              const dup = row.type === "income" && row.amount && detectDuplicates(row);
              return (
                <tr
                  key={row.tempId}
                  className={`border-t border-outline-variant/20 ${
                    row.status === "error" ? "bg-error-container/30" : ""
                  }`}
                >
                  <td className="px-1 py-1">
                    <Input
                      type="date"
                      className="h-8"
                      value={row.date}
                      onChange={(e) =>
                        updateRow(row.tempId, { date: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Select
                      className="h-8"
                      value={row.type}
                      onChange={(e) =>
                        updateRow(row.tempId, {
                          type: e.target.value as TransactionType,
                        })
                      }
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                      <option value="conversion">Conversion</option>
                    </Select>
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      className="h-8"
                      value={row.name}
                      onChange={(e) =>
                        updateRow(row.tempId, { name: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      className="h-8"
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.tempId, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Input
                      className="h-8 font-mono"
                      value={row.amount}
                      onChange={(e) =>
                        updateRow(row.tempId, { amount: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-1 py-1">
                    <Select
                      className="h-8"
                      value={row.currency}
                      onChange={(e) =>
                        updateRow(row.tempId, { currency: e.target.value })
                      }
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-1 py-1">
                    {row.type === "expense" ? (
                      <Select
                        className="h-8"
                        value={row.category}
                        onChange={(e) =>
                          updateRow(row.tempId, {
                            category: e.target.value as ExpenseCategory,
                          })
                        }
                      >
                        {(
                          Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
                        ).map((c) => (
                          <option key={c} value={c}>
                            {EXPENSE_CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Select
                        className="h-8"
                        value={row.paymentMethod}
                        onChange={(e) =>
                          updateRow(row.tempId, {
                            paymentMethod: e.target.value as PaymentMethod,
                          })
                        }
                      >
                        {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(
                          (m) => (
                            <option key={m} value={m}>
                              {PAYMENT_METHOD_LABELS[m]}
                            </option>
                          ),
                        )}
                      </Select>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    {row.type === "conversion" ? (
                      <div className="flex gap-1">
                        <Select
                          className="h-8 w-20"
                          value={row.destinationCurrency}
                          onChange={(e) =>
                            updateRow(row.tempId, {
                              destinationCurrency: e.target.value,
                            })
                          }
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </Select>
                        <Input
                          className="h-8 font-mono"
                          placeholder="dest amt"
                          value={row.destinationAmount}
                          onChange={(e) =>
                            updateRow(row.tempId, {
                              destinationAmount: e.target.value,
                            })
                          }
                        />
                      </div>
                    ) : (
                      <span className="font-mono text-on-surface-variant px-1">
                        {row.fees || "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex flex-col gap-0.5">
                      <Input
                        className="h-8 font-mono"
                        value={
                          row.type === "income"
                            ? orderHint ?? ""
                            : row.referenceNumber
                        }
                        onChange={(e) =>
                          updateRow(row.tempId, {
                            referenceNumber: e.target.value,
                          })
                        }
                        readOnly={row.type === "income"}
                      />
                      {dup ? <Badge tone="warn">Possible duplicate</Badge> : null}
                      {row.message ? (
                        <span
                          className={`text-[10px] ${
                            row.status === "error" ? "text-error" : "text-outline"
                          }`}
                        >
                          {row.message}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      className="p-1.5 rounded text-outline hover:text-error"
                      onClick={() => removeRow(row.tempId)}
                      aria-label="Delete row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
