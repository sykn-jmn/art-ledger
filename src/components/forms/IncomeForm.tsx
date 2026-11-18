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
import { fetchPhpRateFromFrankfurter } from "@/lib/fx/frankfurter";
import { formatMoney, money } from "@/lib/utils/money";
import { formatOrderNumber } from "@/lib/utils/order-number";
import { todayISO } from "@/lib/utils/dates";
import {
  CURRENCIES,
  PAYMENT_METHOD_LABELS,
  type CurrencyCode,
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
  const [fxPreview, setFxPreview] = useState<{
    phpAmount: string;
    rate: string;
    sourceLabel: string;
    status: "idle" | "loading" | "ready" | "error";
    message?: string;
  }>({ phpAmount: "", rate: "", sourceLabel: "", status: "idle" });

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
  const valuationBlank = !(watch.phpTaxValuation ?? "").trim();
  const showAutoPreview =
    watch.currency !== "PHP" &&
    valuationBlank &&
    Boolean(watch.grossAmount) &&
    !Number.isNaN(Number(watch.grossAmount));

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

  useEffect(() => {
    if (!showAutoPreview) {
      setFxPreview((prev) =>
        prev.status === "idle" ? prev : { ...prev, status: "idle", message: undefined },
      );
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFxPreview((prev) => ({ ...prev, status: "loading", message: undefined }));
      try {
        const result = await fetchPhpRateFromFrankfurter({
          fromCurrency: watch.currency as CurrencyCode,
          amount: money(watch.grossAmount),
          onDate: watch.paymentDate || todayISO(),
        });
        if (cancelled) return;
        setFxPreview({
          phpAmount: result.phpAmount,
          rate: result.rate,
          sourceLabel: result.sourceLabel,
          status: "ready",
        });
      } catch (e) {
        if (cancelled) return;
        setFxPreview({
          phpAmount: "",
          rate: "",
          sourceLabel: "",
          status: "error",
          message:
            e instanceof Error
              ? e.message
              : "Could not preview exchange rate. You can still save and retry, or enter PHP valuation manually.",
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    showAutoPreview,
    watch.currency,
    watch.grossAmount,
    watch.paymentDate,
  ]);

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
          <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/60 px-3 py-2.5 text-[12px] text-on-surface-variant leading-relaxed">
            Leave PHP Tax Valuation blank to auto-calculate from the{" "}
            <span className="font-medium text-on-surface">Frankfurter</span>{" "}
            (ECB) exchange rate for the payment date. Auto-filled amounts stay
            tagged <span className="font-medium text-on-surface">Needs review</span>{" "}
            until you open the transaction and click{" "}
            <span className="font-medium text-on-surface">Finalize</span>. Enter
            your own PHP amount anytime to skip auto-fill and accept it
            immediately.
          </div>

          {initial?.phpValuationAutoPending && initial.needsReview ? (
            <div className="rounded bg-error-container/40 px-3 py-2 text-[12px] text-error">
              This valuation was auto-calculated and is still pending. Saving
              unchanged keeps Needs review — use Finalize on the transaction
              details, or edit the PHP amount to confirm it yourself.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="PHP Tax Valuation">
              <Input
                inputMode="decimal"
                placeholder="Blank = auto from Frankfurter"
                {...form.register("phpTaxValuation")}
              />
            </Field>
            <Field label="Valuation Rate / Source">
              <Input
                placeholder="Auto-filled if left blank"
                {...form.register("phpValuationSource")}
              />
            </Field>
          </div>

          {showAutoPreview ? (
            <div className="rounded border border-dashed border-primary/30 bg-primary-fixed/20 px-3 py-2 text-[12px]">
              {fxPreview.status === "loading" ? (
                <p className="text-on-surface-variant">
                  Fetching Frankfurter rate preview…
                </p>
              ) : null}
              {fxPreview.status === "ready" ? (
                <div className="flex flex-col gap-0.5">
                  <p className="font-medium text-on-surface">
                    Auto preview: {formatMoney(fxPreview.phpAmount, "PHP")}{" "}
                    <span className="font-normal text-on-surface-variant">
                      at rate {fxPreview.rate}
                    </span>
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {fxPreview.sourceLabel}. Saved as Needs review until
                    finalized.
                  </p>
                </div>
              ) : null}
              {fxPreview.status === "error" ? (
                <p className="text-error">{fxPreview.message}</p>
              ) : null}
            </div>
          ) : null}
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
