"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input } from "@/components/ui/primitives";
import { calculatePhpValuationFromRate } from "@/lib/calculations/php-valuation";
import { fetchLatestPhpRate } from "@/lib/fx/frankfurter";
import { formatMoney } from "@/lib/utils/money";
import type { CurrencyCode, IncomeTransaction } from "@/types";

interface Props {
  incomes: IncomeTransaction[];
  onApply: (ratesByCurrency: Partial<Record<CurrencyCode, string>>) => Promise<void>;
  onCancel: () => void;
}

type RateRow = {
  currency: CurrencyCode;
  suggested: string | null;
  suggestedDate: string | null;
  status: "loading" | "ready" | "error" | "idle";
  error?: string;
  rate: string;
};

export function BulkPhpValuationPanel({ incomes, onApply, onCancel }: Props) {
  const currencies = useMemo(() => {
    const set = new Set<CurrencyCode>();
    for (const i of incomes) {
      if (i.currency !== "PHP") set.add(i.currency);
    }
    return Array.from(set).sort();
  }, [incomes]);

  const [rows, setRows] = useState<RateRow[]>([]);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(
      currencies.map((currency) => ({
        currency,
        suggested: null,
        suggestedDate: null,
        status: "loading",
        rate: "",
      })),
    );

    let cancelled = false;
    (async () => {
      const next: RateRow[] = [];
      for (const currency of currencies) {
        try {
          const result = await fetchLatestPhpRate({ fromCurrency: currency });
          if (cancelled) return;
          next.push({
            currency,
            suggested: result.rate,
            suggestedDate: result.rateDate,
            status: "ready",
            rate: result.rate,
          });
        } catch (e) {
          if (cancelled) return;
          next.push({
            currency,
            suggested: null,
            suggestedDate: null,
            status: "error",
            error: e instanceof Error ? e.message : "Could not fetch suggestion",
            rate: "",
          });
        }
      }
      if (!cancelled) setRows(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [currencies]);

  const previews = useMemo(() => {
    return incomes.map((income) => {
      const rate = rows.find((r) => r.currency === income.currency)?.rate?.trim();
      if (!rate || Number.isNaN(Number(rate)) || Number(rate) <= 0) {
        return { id: income.id, label: "—", ok: false };
      }
      try {
        const { phpTaxValuation } = calculatePhpValuationFromRate({
          grossAmount: income.grossAmount,
          rate,
        });
        return {
          id: income.id,
          label: formatMoney(phpTaxValuation, "PHP"),
          ok: true,
        };
      } catch {
        return { id: income.id, label: "—", ok: false };
      }
    });
  }, [incomes, rows]);

  const canApply =
    rows.length > 0 &&
    rows.every((r) => r.rate.trim() && !Number.isNaN(Number(r.rate)) && Number(r.rate) > 0);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const ratesByCurrency: Partial<Record<CurrencyCode, string>> = {};
      for (const row of rows) {
        ratesByCurrency[row.currency] = row.rate.trim();
      }
      await onApply(ratesByCurrency);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply valuations");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight">
          Set PHP valuation
        </h2>
        <p className="text-[12px] text-on-surface-variant mt-1 leading-relaxed">
          Frankfurter suggests the latest ECB rate. Enter the final rate you want
          to use — selected income will get{" "}
          <span className="font-medium text-on-surface">
            PHP valuation = gross × rate
          </span>
          .
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div
            key={row.currency}
            className="rounded-lg border border-outline-variant/30 bg-surface-container-low/50 p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">
                {row.currency} → PHP
              </span>
              <span className="text-[11px] text-on-surface-variant font-mono">
                {row.status === "loading"
                  ? "Fetching suggestion…"
                  : row.status === "ready" && row.suggested
                    ? `Suggested ${row.suggested}${row.suggestedDate ? ` · ${row.suggestedDate}` : ""}`
                    : row.status === "error"
                      ? "No suggestion"
                      : null}
              </span>
            </div>
            {row.status === "error" && row.error ? (
              <p className="text-[11px] text-error">{row.error}</p>
            ) : null}
            <Field label="Your exchange rate">
              <Input
                inputMode="decimal"
                value={row.rate}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.currency === row.currency
                        ? { ...r, rate: e.target.value }
                        : r,
                    ),
                  )
                }
                placeholder="e.g. 58.50"
              />
            </Field>
            {row.suggested && row.rate !== row.suggested ? (
              <button
                type="button"
                className="text-[11px] text-primary text-left hover:underline"
                onClick={() =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.currency === row.currency
                        ? { ...r, rate: row.suggested ?? "" }
                        : r,
                    ),
                  )
                }
              >
                Use suggested {row.suggested}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-outline-variant/30 overflow-hidden">
        <div className="px-3 py-2 bg-surface-container-low text-[11px] uppercase tracking-wider text-outline font-semibold">
          Preview ({incomes.length})
        </div>
        <ul className="max-h-48 overflow-y-auto divide-y divide-outline-variant/20">
          {incomes.map((income, idx) => (
            <li
              key={income.id}
              className="px-3 py-2 flex items-center justify-between gap-2 text-[12px]"
            >
              <span className="truncate">
                #{income.orderNumber} · {income.clientName}{" "}
                <span className="text-on-surface-variant font-mono">
                  {formatMoney(income.grossAmount, income.currency)}
                </span>
              </span>
              <span className="font-mono shrink-0">
                {previews[idx]?.label ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="text-[12px] text-error">{error}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!canApply || applying}
          onClick={handleApply}
        >
          {applying ? "Applying…" : `Apply to ${incomes.length}`}
        </Button>
      </div>
    </div>
  );
}
