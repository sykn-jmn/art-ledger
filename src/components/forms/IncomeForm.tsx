"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  incomeFormSchema,
  type IncomeFormValues,
} from "@/lib/validation/schemas";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { calculateIncomeFees } from "@/lib/calculations/fees";
import { formatMoney, money } from "@/lib/utils/money";
import { formatOrderNumber } from "@/lib/utils/order-number";
import { todayISO } from "@/lib/utils/dates";
import {
  CURRENCIES,
  PAYMENT_METHOD_LABELS,
  type IncomeTransaction,
  type PaymentMethod,
} from "@/types";
import { useDb } from "@/components/providers/DbProvider";

interface Props {
  initial?: IncomeTransaction | null;
  defaultDate?: string;
  onSubmit: (values: IncomeFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
  secondaryLabel?: string;
  onSecondary?: (values: IncomeFormValues) => Promise<void>;
}

export function IncomeForm({
  initial,
  defaultDate,
  onSubmit,
  onCancel,
  submitLabel = "Save & Close",
  secondaryLabel,
  onSecondary,
}: Props) {
  const { settings } = useDb();
  const [saving, setSaving] = useState(false);
  const [showFees, setShowFees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: {
      paymentDate: initial?.paymentDate ?? defaultDate ?? todayISO(),
      clientName: initial?.clientName ?? "",
      description: initial?.description ?? "",
      orderNumberOverride: initial?.orderNumber ?? "",
      currency: initial?.currency ?? settings?.defaultCurrency ?? "USD",
      grossAmount: initial?.grossAmount ?? "",
      paymentMethod: initial?.paymentMethod ?? "vgen_paypal",
      feeOverrides: {},
      phpTaxValuation: initial?.phpTaxValuation ?? "",
      phpValuationRate: initial?.phpValuationRate ?? "",
      phpValuationSource: initial?.phpValuationSource ?? "",
    },
  });

  const watch = form.watch();

  const previewOrder = useMemo(() => {
    if (initial?.orderNumber) return initial.orderNumber;
    if (watch.orderNumberOverride?.trim()) {
      try {
        return formatOrderNumber(Number.parseInt(watch.orderNumberOverride, 10));
      } catch {
        return watch.orderNumberOverride;
      }
    }
    return formatOrderNumber(settings?.nextOrderNumber ?? 1);
  }, [initial, settings?.nextOrderNumber, watch.orderNumberOverride]);

  const feePreview = useMemo(() => {
    if (!watch.grossAmount || Number.isNaN(Number(watch.grossAmount))) {
      return null;
    }
    try {
      return calculateIncomeFees({
        grossAmount: money(watch.grossAmount),
        currency: watch.currency,
        paymentMethod: watch.paymentMethod as PaymentMethod,
        rules: settings?.feeRules,
        overrides: {
          vgen: watch.feeOverrides?.vgen,
          paypal: watch.feeOverrides?.paypal,
          stripe: watch.feeOverrides?.stripe,
          wise: watch.feeOverrides?.wise,
          other: watch.feeOverrides?.other,
        },
      });
    } catch {
      return null;
    }
  }, [watch, settings?.feeRules]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        form.handleSubmit(handlePrimary)();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, onSecondary]);

  const handlePrimary = async (values: IncomeFormValues) => {
    setSaving(true);
    setError(null);
    try {
      if (onSecondary) await onSecondary(values);
      else await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (values: IncomeFormValues) => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit(onSecondary ? handlePrimary : handleClose)}
    >
      <p className="font-mono text-[11px] text-outline">
        {initial ? `Order #${initial.orderNumber}` : `Next order #${previewOrder}`}
      </p>

      <Field label="Date of Payment" error={form.formState.errors.paymentDate?.message}>
        <Input type="date" {...form.register("paymentDate")} />
      </Field>

      <Field label="Client / Payer" error={form.formState.errors.clientName?.message}>
        <Input {...form.register("clientName")} placeholder="Client name" />
      </Field>

      <Field label="Description" error={form.formState.errors.description?.message}>
        <Textarea rows={2} {...form.register("description")} />
      </Field>

      <Field label="Order Number (optional override)">
        <Input
          {...form.register("orderNumberOverride")}
          placeholder={previewOrder}
          disabled={Boolean(initial)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <Select {...form.register("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gross Amount" error={form.formState.errors.grossAmount?.message}>
          <Input inputMode="decimal" {...form.register("grossAmount")} placeholder="0.00" />
        </Field>
      </div>

      <Field label="Payment Method">
        <Select {...form.register("paymentMethod")}>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="p-3 bg-surface-container-low rounded-lg flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-[11px]">
          <span className="text-on-surface-variant">
            {feePreview
              ? feePreview.fees
                  .map((f) => `${f.feeType}: -${formatMoney(f.amount, f.currency)}`)
                  .join(" · ") || "No fees"
              : "Enter amount to preview fees"}
          </span>
          <button
            type="button"
            className="text-primary hover:underline font-medium"
            onClick={() => setShowFees((v) => !v)}
          >
            Edit Fees
          </button>
        </div>
        {showFees ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {(["vgen", "paypal", "stripe", "wise"] as const).map((key) => (
              <Field key={key} label={`${key} fee override`}>
                <Input
                  inputMode="decimal"
                  placeholder="auto"
                  {...form.register(`feeOverrides.${key}`)}
                />
              </Field>
            ))}
          </div>
        ) : null}
        <div className="h-px w-full bg-outline-variant/30" />
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-outline font-semibold">
              Net Received
            </div>
            <div className="font-mono text-[10px] text-on-surface-variant">
              Actual deposit to balance
            </div>
          </div>
          <div className="font-mono text-[22px] font-bold tracking-tight">
            {feePreview
              ? formatMoney(feePreview.netReceived, watch.currency)
              : "—"}
          </div>
        </div>
      </div>

      {watch.currency !== "PHP" ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-on-surface-variant leading-relaxed">
            Optional now — leave blank to mark Needs review, then select
            transactions in the list and use{" "}
            <span className="font-medium text-on-surface">Set PHP valuation</span>{" "}
            to apply an exchange rate in bulk.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="PHP Tax Valuation">
              <Input
                inputMode="decimal"
                placeholder="Optional — or bulk update later"
                {...form.register("phpTaxValuation")}
              />
            </Field>
            <Field label="Valuation Rate / Source">
              <Input
                placeholder="e.g. BSP / manual"
                {...form.register("phpValuationSource")}
              />
            </Field>
          </div>
        </div>
      ) : null}

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
                onClick={form.handleSubmit(handleClose)}
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
