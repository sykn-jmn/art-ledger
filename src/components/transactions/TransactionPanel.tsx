"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { IncomeForm } from "@/components/forms/IncomeForm";
import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { ConversionForm } from "@/components/forms/ConversionForm";
import {
  createConversion,
  createExpense,
  createIncome,
  updateConversion,
  updateExpense,
  updateIncome,
} from "@/db/transactions";
import type {
  ConversionFormValues,
  ExpenseFormValues,
  IncomeFormValues,
} from "@/lib/validation/schemas";
import type {
  CurrencyConversion,
  ExpenseTransaction,
  IncomeTransaction,
  TransactionType,
} from "@/types";
import { todayISO } from "@/lib/utils/dates";

export type PanelMode =
  | { kind: "create"; type: TransactionType }
  | {
      kind: "edit";
      type: "income";
      record: IncomeTransaction;
    }
  | {
      kind: "edit";
      type: "expense";
      record: ExpenseTransaction;
    }
  | {
      kind: "edit";
      type: "conversion";
      record: CurrencyConversion;
    };

interface Props {
  mode: PanelMode | null;
  onClose: () => void;
  stickyDate?: string;
}

export function TransactionPanel({ mode, onClose, stickyDate }: Props) {
  const [type, setType] = useState<TransactionType>("income");
  const [dateDefault, setDateDefault] = useState(stickyDate ?? todayISO());

  useEffect(() => {
    if (!mode) return;
    setType(mode.type);
    if (mode.kind === "create") {
      setDateDefault(stickyDate ?? todayISO());
    }
  }, [mode, stickyDate]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const title =
    mode.kind === "edit"
      ? `Edit ${mode.type}`
      : type === "income"
        ? "New Income Transaction"
        : type === "expense"
          ? "New Expense Transaction"
          : "New Currency Conversion";

  const handleIncomeSave = async (values: IncomeFormValues) => {
    if (mode.kind === "edit" && mode.type === "income") {
      await updateIncome(mode.record.id, values);
      onClose();
      return;
    }
    await createIncome(values);
    onClose();
  };

  const handleExpenseSave = async (values: ExpenseFormValues) => {
    if (mode.kind === "edit" && mode.type === "expense") {
      await updateExpense(mode.record.id, values);
      onClose();
      return;
    }
    await createExpense(values);
    onClose();
  };

  const handleConversionSave = async (values: ConversionFormValues) => {
    if (mode.kind === "edit" && mode.type === "conversion") {
      await updateConversion(mode.record.id, values);
      onClose();
      return;
    }
    await createConversion(values);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 top-14 left-0 lg:left-60 bg-inverse-surface/35 backdrop-blur-[2px] z-30"
        onClick={onClose}
      />
      <aside className="fixed top-14 right-0 bottom-0 w-full max-w-[480px] bg-surface-container-lowest shadow-2xl z-40 flex flex-col overflow-hidden">
        <div className="px-6 pt-5 pb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            className="w-7 h-7 rounded flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {mode.kind === "create" ? (
            <div className="grid grid-cols-3 p-0.5 bg-surface-container rounded-lg mb-4 text-[12px]">
              {(["income", "expense", "conversion"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-1.5 rounded-md capitalize ${
                    type === t
                      ? "bg-surface-container-lowest text-primary font-semibold shadow-sm"
                      : "text-on-surface-variant"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}

          {type === "income" ? (
            <IncomeForm
              initial={
                mode.kind === "edit" && mode.type === "income"
                  ? mode.record
                  : null
              }
              defaultDate={dateDefault}
              onCancel={onClose}
              onSubmit={handleIncomeSave}
            />
          ) : null}
          {type === "expense" ? (
            <ExpenseForm
              initial={
                mode.kind === "edit" && mode.type === "expense"
                  ? mode.record
                  : null
              }
              defaultDate={dateDefault}
              onCancel={onClose}
              onSubmit={handleExpenseSave}
            />
          ) : null}
          {type === "conversion" ? (
            <ConversionForm
              initial={
                mode.kind === "edit" && mode.type === "conversion"
                  ? mode.record
                  : null
              }
              defaultDate={dateDefault}
              onCancel={onClose}
              onSubmit={handleConversionSave}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}
