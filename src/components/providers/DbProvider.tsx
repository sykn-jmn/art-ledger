"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type {
  AppSettings,
  CurrencyConversion,
  ExpenseTransaction,
  FeeRecord,
  IncomeTransaction,
  OpeningBalance,
  TaxPayment,
} from "@/types";
import { ensureSettings, getDb } from "@/db/database";

interface DbContextValue {
  ready: boolean;
  settings: AppSettings | undefined;
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  conversions: CurrencyConversion[];
  fees: FeeRecord[];
  taxPayments: TaxPayment[];
  openingBalances: OpeningBalance[];
  refreshSettings: () => Promise<void>;
}

const DbContext = createContext<DbContextValue | null>(null);

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureSettings();
        if (!cancelled) setReady(true);
      } catch (e) {
        console.error(e);
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const settings = useLiveQuery(async () => {
    if (typeof window === "undefined" || !ready) return undefined;
    return getDb().settings.get("settings");
  }, [ready, settingsVersion]);

  const incomesQuery = useLiveQuery(async () => {
    if (!ready) return [];
    return getDb().incomes.orderBy("paymentDate").reverse().toArray();
  }, [ready]);

  const expensesQuery = useLiveQuery(async () => {
    if (!ready) return [];
    return getDb().expenses.orderBy("paymentDate").reverse().toArray();
  }, [ready]);

  const conversionsQuery = useLiveQuery(async () => {
    if (!ready) return [];
    return getDb().conversions.orderBy("conversionDate").reverse().toArray();
  }, [ready]);

  const feesQuery = useLiveQuery(async () => {
    if (!ready) return [];
    return getDb().fees.toArray();
  }, [ready]);

  const taxPaymentsQuery = useLiveQuery(async () => {
    if (!ready) return [];
    return getDb().taxPayments.toArray();
  }, [ready]);

  const openingBalancesQuery = useLiveQuery(async () => {
    if (!ready) return [];
    return getDb().openingBalances.toArray();
  }, [ready]);

  const refreshSettings = useCallback(async () => {
    await ensureSettings();
    setSettingsVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      settings,
      incomes: incomesQuery ?? [],
      expenses: expensesQuery ?? [],
      conversions: conversionsQuery ?? [],
      fees: feesQuery ?? [],
      taxPayments: taxPaymentsQuery ?? [],
      openingBalances: openingBalancesQuery ?? [],
      refreshSettings,
    }),
    [
      ready,
      settings,
      incomesQuery,
      expensesQuery,
      conversionsQuery,
      feesQuery,
      taxPaymentsQuery,
      openingBalancesQuery,
      refreshSettings,
    ],
  );

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>;
}

export function useDb() {
  const ctx = useContext(DbContext);
  if (!ctx) throw new Error("useDb must be used within DbProvider");
  return ctx;
}
