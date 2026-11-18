"use client";

import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  CurrencyConversion,
  ExpenseTransaction,
  FeeRecord,
  IncomeTransaction,
  OpeningBalance,
  TaxPayment,
} from "@/types";
import { DEFAULT_FEE_RULES } from "@/lib/calculations/fees";
import { nowISO } from "@/lib/utils/dates";

export const SCHEMA_VERSION = 1;

/** Open version used by Dexie stores; keep >= any prior local ArtLedgerDB version. */
const DEXIE_STORE_VERSION = 11;

export class ArtLedgerDB extends Dexie {
  incomes!: EntityTable<IncomeTransaction, "id">;
  expenses!: EntityTable<ExpenseTransaction, "id">;
  conversions!: EntityTable<CurrencyConversion, "id">;
  fees!: EntityTable<FeeRecord, "id">;
  taxPayments!: EntityTable<TaxPayment, "id">;
  openingBalances!: EntityTable<OpeningBalance, "id">;
  settings!: EntityTable<AppSettings, "id">;

  constructor() {
    super("ArtLedgerDB");
    // Use a high enough Dexie version so older leftover DBs on this origin can upgrade.
    this.version(DEXIE_STORE_VERSION).stores({
      incomes:
        "id, paymentDate, orderNumber, currency, paymentMethod, needsReview, clientName",
      expenses: "id, paymentDate, category, currency, payee",
      conversions: "id, conversionDate, sourceCurrency, destinationCurrency",
      fees: "id, transactionId, transactionType, feeType",
      taxPayments: "id, taxYear, period, paymentDate",
      openingBalances: "id, currency, effectiveDate",
      settings: "id",
    });
  }
}

let dbInstance: ArtLedgerDB | null = null;

export function getDb(): ArtLedgerDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("ArtLedgerDB requires IndexedDB (browser or test polyfill)");
  }
  if (!dbInstance) {
    dbInstance = new ArtLedgerDB();
  }
  return dbInstance;
}

export function createDefaultSettings(
  year = new Date().getFullYear(),
): AppSettings {
  const ts = nowISO();
  return {
    id: "settings",
    startingOrderNumber: 1,
    nextOrderNumber: 1,
    defaultCurrency: "USD",
    feeRules: { ...DEFAULT_FEE_RULES },
    revenueSharePercent: "10",
    taxDeductionAmount: "250000",
    taxRatePercent: "8",
    selectedYear: year,
    selectedQuarter: "all",
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function ensureSettings(): Promise<AppSettings> {
  const db = getDb();
  const existing = await db.settings.get("settings");
  if (existing) return existing;
  const defaults = createDefaultSettings();
  await db.settings.put(defaults);
  return defaults;
}

/** Reset singleton — used in tests */
export function resetDbInstance(): void {
  dbInstance = null;
}
