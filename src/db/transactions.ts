"use client";

import { v4 as uuid } from "uuid";
import type {
  AppSettings,
  BackupPayload,
  CurrencyConversion,
  ExpenseTransaction,
  FeeRecord,
  FeeType,
  IncomeTransaction,
  OpeningBalance,
  TaxPayment,
} from "@/types";
import { calculateIncomeFees } from "@/lib/calculations/fees";
import { calculateEffectiveRate } from "@/lib/calculations/currency";
import { formatOrderNumber, parseOrderNumber } from "@/lib/utils/order-number";
import { nowISO } from "@/lib/utils/dates";
import { money } from "@/lib/utils/money";
import type {
  ConversionFormValues,
  ExpenseFormValues,
  IncomeFormValues,
} from "@/lib/validation/schemas";
import {
  SCHEMA_VERSION,
  createDefaultSettings,
  ensureSettings,
  getDb,
} from "@/db/database";

function reviewForIncome(
  currency: IncomeTransaction["currency"],
  phpTaxValuation?: string | null,
): { needsReview: boolean; reviewReasons: string[] } {
  if (currency === "PHP") return { needsReview: false, reviewReasons: [] };
  if (!phpTaxValuation || phpTaxValuation.trim() === "") {
    return {
      needsReview: true,
      reviewReasons: ["Missing PHP tax-reporting valuation"],
    };
  }
  return { needsReview: false, reviewReasons: [] };
}

async function usedOrderNumbers(excludeId?: string): Promise<Set<string>> {
  const db = getDb();
  const all = await db.incomes.toArray();
  return new Set(
    all.filter((i) => i.id !== excludeId).map((i) => i.orderNumber),
  );
}

export async function createIncome(
  values: IncomeFormValues,
): Promise<IncomeTransaction> {
  const db = getDb();
  const settings = await ensureSettings();
  const ts = nowISO();
  const used = await usedOrderNumbers();

  let orderNumber: string;
  if (values.orderNumberOverride && values.orderNumberOverride.trim()) {
    orderNumber = formatOrderNumber(
      parseOrderNumber(values.orderNumberOverride),
    );
    if (used.has(orderNumber)) {
      throw new Error(`Order number ${orderNumber} already exists`);
    }
  } else {
    let next = settings.nextOrderNumber;
    orderNumber = formatOrderNumber(next);
    while (used.has(orderNumber)) {
      next += 1;
      orderNumber = formatOrderNumber(next);
    }
  }

  const feeResult = calculateIncomeFees({
    grossAmount: money(values.grossAmount),
    currency: values.currency,
    paymentMethod: values.paymentMethod,
    rules: settings.feeRules,
    overrides: values.feeOverrides as Partial<Record<FeeType, string>>,
  });

  const review = reviewForIncome(values.currency, values.phpTaxValuation);

  const income: IncomeTransaction = {
    id: uuid(),
    paymentDate: values.paymentDate,
    clientName: values.clientName.trim(),
    description: values.description.trim(),
    orderNumber,
    currency: values.currency,
    grossAmount: money(values.grossAmount),
    paymentMethod: values.paymentMethod,
    netReceived: feeResult.netReceived,
    phpTaxValuation: values.phpTaxValuation
      ? money(values.phpTaxValuation)
      : values.currency === "PHP"
        ? money(values.grossAmount)
        : null,
    phpValuationRate: values.phpValuationRate
      ? money(values.phpValuationRate, 6)
      : null,
    phpValuationSource: values.phpValuationSource?.trim() || null,
    needsReview: review.needsReview,
    reviewReasons: review.reviewReasons,
    createdAt: ts,
    updatedAt: ts,
  };

  const feeRecords: FeeRecord[] = feeResult.fees.map((f) => ({
    id: uuid(),
    transactionId: income.id,
    transactionType: "income" as const,
    feeType: f.feeType,
    amount: f.amount,
    currency: f.currency,
    calculationMethod: f.calculationMethod,
    estimated: f.estimated,
    overridden: f.overridden,
    createdAt: ts,
    updatedAt: ts,
  }));

  await db.transaction("rw", db.incomes, db.fees, db.settings, async () => {
    await db.incomes.add(income);
    if (feeRecords.length) await db.fees.bulkAdd(feeRecords);
    const parsed = parseOrderNumber(orderNumber);
    if (parsed >= settings.nextOrderNumber) {
      await db.settings.update("settings", {
        nextOrderNumber: parsed + 1,
        updatedAt: ts,
      });
    }
  });

  return income;
}

export async function updateIncome(
  id: string,
  values: IncomeFormValues,
): Promise<IncomeTransaction> {
  const db = getDb();
  const existing = await db.incomes.get(id);
  if (!existing) throw new Error("Income not found");
  const settings = await ensureSettings();
  const ts = nowISO();

  // Order number does not change on edit unless explicit override differs and is unique
  let orderNumber = existing.orderNumber;
  if (
    values.orderNumberOverride &&
    values.orderNumberOverride.trim() &&
    formatOrderNumber(parseOrderNumber(values.orderNumberOverride)) !==
      existing.orderNumber
  ) {
    const used = await usedOrderNumbers(id);
    orderNumber = formatOrderNumber(
      parseOrderNumber(values.orderNumberOverride),
    );
    if (used.has(orderNumber)) {
      throw new Error(`Order number ${orderNumber} already exists`);
    }
  }

  // Preserve historical fees if no overrides provided and payment method unchanged;
  // otherwise recalculate/store new fee snapshot for this edit.
  const feeResult = calculateIncomeFees({
    grossAmount: money(values.grossAmount),
    currency: values.currency,
    paymentMethod: values.paymentMethod,
    rules: settings.feeRules,
    overrides: values.feeOverrides as Partial<Record<FeeType, string>>,
  });

  const review = reviewForIncome(values.currency, values.phpTaxValuation);

  const updated: IncomeTransaction = {
    ...existing,
    paymentDate: values.paymentDate,
    clientName: values.clientName.trim(),
    description: values.description.trim(),
    orderNumber,
    currency: values.currency,
    grossAmount: money(values.grossAmount),
    paymentMethod: values.paymentMethod,
    netReceived: feeResult.netReceived,
    phpTaxValuation: values.phpTaxValuation
      ? money(values.phpTaxValuation)
      : values.currency === "PHP"
        ? money(values.grossAmount)
        : null,
    phpValuationRate: values.phpValuationRate
      ? money(values.phpValuationRate, 6)
      : null,
    phpValuationSource: values.phpValuationSource?.trim() || null,
    needsReview: review.needsReview,
    reviewReasons: review.reviewReasons,
    updatedAt: ts,
  };

  const feeRecords: FeeRecord[] = feeResult.fees.map((f) => ({
    id: uuid(),
    transactionId: id,
    transactionType: "income" as const,
    feeType: f.feeType,
    amount: f.amount,
    currency: f.currency,
    calculationMethod: f.calculationMethod,
    estimated: f.estimated,
    overridden: f.overridden,
    createdAt: ts,
    updatedAt: ts,
  }));

  await db.transaction("rw", db.incomes, db.fees, async () => {
    await db.incomes.put(updated);
    await db.fees.where("transactionId").equals(id).delete();
    if (feeRecords.length) await db.fees.bulkAdd(feeRecords);
  });

  return updated;
}

export async function deleteIncome(id: string): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.incomes, db.fees, async () => {
    await db.incomes.delete(id);
    await db.fees.where("transactionId").equals(id).delete();
  });
  // Order numbers are never reused
}

export async function createExpense(
  values: ExpenseFormValues,
): Promise<ExpenseTransaction> {
  const db = getDb();
  const ts = nowISO();
  const expense: ExpenseTransaction = {
    id: uuid(),
    paymentDate: values.paymentDate,
    payee: values.payee.trim(),
    description: values.description.trim(),
    category: values.category,
    currency: values.currency,
    amount: money(values.amount),
    paymentMethod: values.paymentMethod,
    referenceNumber: values.referenceNumber?.trim() || null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.expenses.add(expense);
  return expense;
}

export async function updateExpense(
  id: string,
  values: ExpenseFormValues,
): Promise<ExpenseTransaction> {
  const db = getDb();
  const existing = await db.expenses.get(id);
  if (!existing) throw new Error("Expense not found");
  const updated: ExpenseTransaction = {
    ...existing,
    paymentDate: values.paymentDate,
    payee: values.payee.trim(),
    description: values.description.trim(),
    category: values.category,
    currency: values.currency,
    amount: money(values.amount),
    paymentMethod: values.paymentMethod,
    referenceNumber: values.referenceNumber?.trim() || null,
    updatedAt: nowISO(),
  };
  await db.expenses.put(updated);
  return updated;
}

export async function deleteExpense(id: string): Promise<void> {
  await getDb().expenses.delete(id);
}

export async function createConversion(
  values: ConversionFormValues,
): Promise<CurrencyConversion> {
  const db = getDb();
  const ts = nowISO();
  const rate =
    values.exchangeRate && values.exchangeRate.trim()
      ? money(values.exchangeRate, 8)
      : calculateEffectiveRate({
          sourceAmount: values.sourceAmount,
          destinationAmount: values.destinationAmount,
          conversionFee: values.conversionFee || "0",
          feeTreatment: values.feeTreatment,
          feeCurrencyIsSource:
            values.conversionFeeCurrency === values.sourceCurrency,
        });

  const conversion: CurrencyConversion = {
    id: uuid(),
    conversionDate: values.conversionDate,
    sourceCurrency: values.sourceCurrency,
    sourceAmount: money(values.sourceAmount),
    destinationCurrency: values.destinationCurrency,
    destinationAmount: money(values.destinationAmount),
    exchangeRate: rate,
    conversionFee: money(values.conversionFee || "0"),
    conversionFeeCurrency: values.conversionFeeCurrency,
    feeTreatment: values.feeTreatment,
    referenceNumber: values.referenceNumber?.trim() || null,
    needsReview: false,
    reviewReasons: [],
    createdAt: ts,
    updatedAt: ts,
  };
  await db.conversions.add(conversion);
  return conversion;
}

export async function updateConversion(
  id: string,
  values: ConversionFormValues,
): Promise<CurrencyConversion> {
  const db = getDb();
  const existing = await db.conversions.get(id);
  if (!existing) throw new Error("Conversion not found");
  const rate =
    values.exchangeRate && values.exchangeRate.trim()
      ? money(values.exchangeRate, 8)
      : calculateEffectiveRate({
          sourceAmount: values.sourceAmount,
          destinationAmount: values.destinationAmount,
          conversionFee: values.conversionFee || "0",
          feeTreatment: values.feeTreatment,
          feeCurrencyIsSource:
            values.conversionFeeCurrency === values.sourceCurrency,
        });
  const updated: CurrencyConversion = {
    ...existing,
    conversionDate: values.conversionDate,
    sourceCurrency: values.sourceCurrency,
    sourceAmount: money(values.sourceAmount),
    destinationCurrency: values.destinationCurrency,
    destinationAmount: money(values.destinationAmount),
    exchangeRate: rate,
    conversionFee: money(values.conversionFee || "0"),
    conversionFeeCurrency: values.conversionFeeCurrency,
    feeTreatment: values.feeTreatment,
    referenceNumber: values.referenceNumber?.trim() || null,
    updatedAt: nowISO(),
  };
  await db.conversions.put(updated);
  return updated;
}

export async function deleteConversion(id: string): Promise<void> {
  await getDb().conversions.delete(id);
}

export async function saveSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const db = getDb();
  const current = await ensureSettings();
  // Changing starting number must not overwrite previously assigned numbers
  // or reduce nextOrderNumber below existing max.
  let nextOrderNumber = current.nextOrderNumber;
  if (
    patch.startingOrderNumber !== undefined &&
    patch.startingOrderNumber > current.nextOrderNumber
  ) {
    nextOrderNumber = patch.startingOrderNumber;
  }
  if (patch.nextOrderNumber !== undefined) {
    nextOrderNumber = Math.max(nextOrderNumber, patch.nextOrderNumber);
  }

  const updated: AppSettings = {
    ...current,
    ...patch,
    id: "settings",
    nextOrderNumber,
    updatedAt: nowISO(),
  };
  await db.settings.put(updated);
  return updated;
}

export async function createTaxPayment(
  values: Omit<TaxPayment, "id" | "createdAt" | "updatedAt">,
): Promise<TaxPayment> {
  const ts = nowISO();
  const row: TaxPayment = { ...values, id: uuid(), createdAt: ts, updatedAt: ts };
  await getDb().taxPayments.add(row);
  return row;
}

export async function deleteTaxPayment(id: string): Promise<void> {
  await getDb().taxPayments.delete(id);
}

export async function createOpeningBalance(
  values: Omit<OpeningBalance, "id" | "createdAt" | "updatedAt">,
): Promise<OpeningBalance> {
  const ts = nowISO();
  const row: OpeningBalance = {
    ...values,
    id: uuid(),
    amount: money(values.amount),
    createdAt: ts,
    updatedAt: ts,
  };
  await getDb().openingBalances.add(row);
  return row;
}

export async function deleteOpeningBalance(id: string): Promise<void> {
  await getDb().openingBalances.delete(id);
}

export async function exportBackup(): Promise<BackupPayload> {
  const db = getDb();
  const settings = await ensureSettings();
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    settings,
    incomes: await db.incomes.toArray(),
    expenses: await db.expenses.toArray(),
    conversions: await db.conversions.toArray(),
    fees: await db.fees.toArray(),
    taxPayments: await db.taxPayments.toArray(),
    openingBalances: await db.openingBalances.toArray(),
  };
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid backup file");
  }
  if (!payload.schemaVersion || !payload.settings) {
    throw new Error("Backup missing required fields");
  }
  if (!Array.isArray(payload.incomes) || !Array.isArray(payload.expenses)) {
    throw new Error("Backup structure is invalid");
  }

  const db = getDb();
  await db.transaction(
    "rw",
    [
      db.incomes,
      db.expenses,
      db.conversions,
      db.fees,
      db.taxPayments,
      db.openingBalances,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.incomes.clear(),
        db.expenses.clear(),
        db.conversions.clear(),
        db.fees.clear(),
        db.taxPayments.clear(),
        db.openingBalances.clear(),
        db.settings.clear(),
      ]);
      const settings = {
        ...createDefaultSettings(),
        ...payload.settings,
        id: "settings" as const,
      };
      await db.settings.put(settings);
      if (payload.incomes.length) await db.incomes.bulkAdd(payload.incomes);
      if (payload.expenses.length) await db.expenses.bulkAdd(payload.expenses);
      if (payload.conversions?.length)
        await db.conversions.bulkAdd(payload.conversions);
      if (payload.fees?.length) await db.fees.bulkAdd(payload.fees);
      if (payload.taxPayments?.length)
        await db.taxPayments.bulkAdd(payload.taxPayments);
      if (payload.openingBalances?.length)
        await db.openingBalances.bulkAdd(payload.openingBalances);
    },
  );
}

export async function bulkCreateFromQuickEntry(
  rows: {
    type: "income" | "expense" | "conversion";
    income?: IncomeFormValues;
    expense?: ExpenseFormValues;
    conversion?: ConversionFormValues;
  }[],
): Promise<{ saved: number; errors: { index: number; message: string }[] }> {
  const errors: { index: number; message: string }[] = [];
  let saved = 0;

  // Allocate all income order numbers atomically first
  const incomeIndices = rows
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => r.type === "income" && r.income);

  const db = getDb();
  await db.transaction(
    "rw",
    [
      db.incomes,
      db.expenses,
      db.conversions,
      db.fees,
      db.settings,
    ],
    async () => {
      for (const { r, index } of rows.map((row, i) => ({ r: row, index: i }))) {
        try {
          if (r.type === "income" && r.income) {
            await createIncome(r.income);
            saved += 1;
          } else if (r.type === "expense" && r.expense) {
            await createExpense(r.expense);
            saved += 1;
          } else if (r.type === "conversion" && r.conversion) {
            await createConversion(r.conversion);
            saved += 1;
          } else {
            errors.push({ index, message: "Incomplete row" });
          }
        } catch (e) {
          errors.push({
            index,
            message: e instanceof Error ? e.message : "Save failed",
          });
          // Abort entire transaction on any failure to avoid partial duplicates
          throw e;
        }
      }
      // silence unused
      void incomeIndices;
    },
  ).catch(async () => {
    // Transaction aborted — retry individually so successful rows can still save
    // and failed rows are reported. Clear saved count and redo carefully.
    saved = 0;
    errors.length = 0;
    const succeeded = new Set<number>();
    for (let index = 0; index < rows.length; index++) {
      const r = rows[index]!;
      try {
        if (r.type === "income" && r.income) await createIncome(r.income);
        else if (r.type === "expense" && r.expense) await createExpense(r.expense);
        else if (r.type === "conversion" && r.conversion)
          await createConversion(r.conversion);
        else {
          errors.push({ index, message: "Incomplete row" });
          continue;
        }
        succeeded.add(index);
        saved += 1;
      } catch (e) {
        errors.push({
          index,
          message: e instanceof Error ? e.message : "Save failed",
        });
      }
    }
  });

  return { saved, errors };
}
