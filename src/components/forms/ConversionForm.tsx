"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  conversionFormSchema,
  type ConversionFormValues,
} from "@/lib/validation/schemas";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { checkConversionBalance } from "@/lib/calculations/balances";
import { calculateEffectiveRate } from "@/lib/calculations/currency";
import { CURRENCIES, type CurrencyConversion } from "@/types";
import { useDb } from "@/components/providers/DbProvider";

interface Props {
  initial?: CurrencyConversion | null;
  defaultDate?: string;
  onSubmit: (values: ConversionFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  onSecondary?: (values: ConversionFormValues) => Promise<void>;
  secondaryLabel?: string;
}

export function ConversionForm({
  initial,
  defaultDate,
  onSubmit,
  onCancel,
  submitLabel = "Save & Close",
  onSecondary,
  secondaryLabel,
}: Props) {
  const { incomes, expenses, conversions, openingBalances } = useDb();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ConversionFormValues>({
    resolver: zodResolver(conversionFormSchema),
    defaultValues: {
      conversionDate: initial?.conversionDate ?? defaultDate ?? todayISO(),
      sourceCurrency: initial?.sourceCurrency ?? "USD",
      sourceAmount: initial?.sourceAmount ?? "",
      destinationCurrency: initial?.destinationCurrency ?? "PHP",
      destinationAmount: initial?.destinationAmount ?? "",
      exchangeRate: initial?.exchangeRate ?? "",
      conversionFee: initial?.conversionFee ?? "0",
      conversionFeeCurrency: initial?.conversionFeeCurrency ?? "USD",
      feeTreatment: initial?.feeTreatment ?? "from_source",
      referenceNumber: initial?.referenceNumber ?? "",
    },
  });

  const watch = form.watch();

  const balanceCheck = useMemo(() => {
    if (!watch.sourceAmount) return null;
    try {
      return checkConversionBalance({
        openings: openingBalances,
        incomes,
        expenses,
        conversions,
        sourceCurrency: watch.sourceCurrency,
        sourceAmount: watch.sourceAmount,
        conversionFee: watch.conversionFee || "0",
        conversionFeeCurrency: watch.conversionFeeCurrency,
        feeTreatment: watch.feeTreatment,
        excludeConversionId: initial?.id,
      });
    } catch {
      return null;
    }
  }, [
    watch,
    openingBalances,
    incomes,
    expenses,
    conversions,
    initial?.id,
  ]);

  const effectiveRate = useMemo(() => {
    if (!watch.sourceAmount || !watch.destinationAmount) return null;
    try {
      return calculateEffectiveRate({
        sourceAmount: watch.sourceAmount,
        destinationAmount: watch.destinationAmount,
        conversionFee: watch.conversionFee || "0",
        feeTreatment: watch.feeTreatment,
        feeCurrencyIsSource:
          watch.conversionFeeCurrency === watch.sourceCurrency,
      });
    } catch {
      return null;
    }
  }, [watch]);

  const run = async (values: ConversionFormValues, close: boolean) => {
    setSaving(true);
    setError(null);
    try {
      if (!close && onSecondary) await onSecondary(values);
      else await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit((v) => run(v, !onSecondary))}
    >
      <Field label="Conversion Date" error={form.formState.errors.conversionDate?.message}>
        <Input type="date" {...form.register("conversionDate")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Source Currency">
          <Select {...form.register("sourceCurrency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source Amount" error={form.formState.errors.sourceAmount?.message}>
          <Input inputMode="decimal" {...form.register("sourceAmount")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Destination Currency"
          error={form.formState.errors.destinationCurrency?.message}
        >
          <Select {...form.register("destinationCurrency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Destination Amount"
          error={form.formState.errors.destinationAmount?.message}
        >
          <Input inputMode="decimal" {...form.register("destinationAmount")} />
        </Field>
      </div>

      <Field label="Exchange Rate (optional manual)">
        <Input
          inputMode="decimal"
          placeholder={effectiveRate ?? "auto from amounts"}
          {...form.register("exchangeRate")}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Conversion Fee">
          <Input inputMode="decimal" {...form.register("conversionFee")} />
        </Field>
        <Field label="Fee Currency">
          <Select {...form.register("conversionFeeCurrency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Fee Treatment">
        <Select {...form.register("feeTreatment")}>
          <option value="from_source">Taken from source</option>
          <option value="from_destination">Taken from destination</option>
          <option value="separate">Paid separately</option>
        </Select>
      </Field>

      <Field label="Reference Number (optional)">
        <Input {...form.register("referenceNumber")} />
      </Field>

      {balanceCheck ? (
        <div
          className={`rounded px-3 py-2 text-[12px] ${
            balanceCheck.sufficient
              ? "bg-surface-container-low text-on-surface-variant"
              : "bg-error-container text-error"
          }`}
        >
          Available {formatMoney(balanceCheck.available, watch.sourceCurrency)} ·
          Required {formatMoney(balanceCheck.required, watch.sourceCurrency)}
          {!balanceCheck.sufficient
            ? " — recorded source balance appears insufficient."
            : null}
        </div>
      ) : null}

      <p className="text-[11px] text-on-surface-variant">
        Conversions apply to combined balances, not a single commission. PHP tax
        valuation for income is separate and is not set by this conversion.
      </p>

      {error ? <p className="text-[12px] text-error">{error}</p> : null}

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="danger" onClick={onCancel}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          {onSecondary ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={form.handleSubmit((v) => run(v, true))}
              >
                {submitLabel}
              </Button>
              <Button type="submit" disabled={saving}>
                {secondaryLabel ?? "Save & Add Another"}
              </Button>
            </>
          ) : (
            <Button type="submit" disabled={saving}>
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
