"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  expenseFormSchema,
  type ExpenseFormValues,
} from "@/lib/validation/schemas";
import { Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { todayISO } from "@/lib/utils/dates";
import {
  CURRENCIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type ExpenseCategory,
  type ExpenseTransaction,
  type PaymentMethod,
} from "@/types";
import { useDb } from "@/components/providers/DbProvider";

interface Props {
  initial?: ExpenseTransaction | null;
  defaultDate?: string;
  onSubmit: (values: ExpenseFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ExpenseForm({
  initial,
  defaultDate,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: Props) {
  const { settings } = useDb();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      paymentDate: initial?.paymentDate ?? defaultDate ?? todayISO(),
      payee: initial?.payee ?? "",
      description: initial?.description ?? "",
      category: initial?.category ?? "tools_brushes",
      currency: initial?.currency ?? settings?.defaultCurrency ?? "PHP",
      amount: initial?.amount ?? "",
      paymentMethod: initial?.paymentMethod ?? "bank_transfer",
      referenceNumber: initial?.referenceNumber ?? "",
    },
  });

  const category = form.watch("category");

  const run = async (values: ExpenseFormValues) => {
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
      onSubmit={form.handleSubmit(run)}
    >
      <Field label="Date" error={form.formState.errors.paymentDate?.message}>
        <Input type="date" {...form.register("paymentDate")} />
      </Field>
      <Field label="Payee / Store" error={form.formState.errors.payee?.message}>
        <Input {...form.register("payee")} />
      </Field>
      <Field label="Description" error={form.formState.errors.description?.message}>
        <Textarea rows={2} {...form.register("description")} />
      </Field>
      <Field label="Category">
        <Select {...form.register("category")}>
          {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      {category === "owners_drawings" || category === "monthly_revenue_share" ? (
        <p className="text-[11px] text-on-surface-variant bg-surface-container-low rounded px-2 py-1.5">
          {category === "owners_drawings"
            ? "Owner's drawings are tracked separately and are not ordinary business expenses."
            : "Revenue-share payments are tracked separately from calculated obligations."}
        </p>
      ) : null}
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
        <Field label="Amount" error={form.formState.errors.amount?.message}>
          <Input inputMode="decimal" {...form.register("amount")} />
        </Field>
      </div>
      <Field label="Payment Method">
        <Select {...form.register("paymentMethod")}>
          {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Reference Number (optional)">
        <Input {...form.register("referenceNumber")} />
      </Field>

      {error ? <p className="text-[12px] text-error">{error}</p> : null}

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="danger" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
