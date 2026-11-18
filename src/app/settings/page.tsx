"use client";

import { useEffect, useState } from "react";
import { useDb } from "@/components/providers/DbProvider";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  createOpeningBalance,
  deleteOpeningBalance,
  exportBackup,
  importBackup,
  saveSettings,
} from "@/db/transactions";
import type { BackupPayload, CurrencyCode } from "@/types";
import { CURRENCIES } from "@/types";
import { todayISO } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

export default function SettingsPage() {
  const { ready, settings, openingBalances, refreshSettings } = useDb();
  const [startingOrderNumber, setStartingOrderNumber] = useState("1");
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>("USD");
  const [revenueSharePercent, setRevenueSharePercent] = useState("10");
  const [taxDeductionAmount, setTaxDeductionAmount] = useState("250000");
  const [taxRatePercent, setTaxRatePercent] = useState("8");
  const [vgenPercent, setVgenPercent] = useState("5");
  const [paypalPercent, setPaypalPercent] = useState("4.4");
  const [paypalFixed, setPaypalFixed] = useState("0.30");
  const [message, setMessage] = useState<string | null>(null);

  const [obCurrency, setObCurrency] = useState<CurrencyCode>("USD");
  const [obAmount, setObAmount] = useState("");
  const [obDate, setObDate] = useState(todayISO());
  const [obLocation, setObLocation] = useState("");

  useEffect(() => {
    if (!settings) return;
    setStartingOrderNumber(String(settings.startingOrderNumber));
    setDefaultCurrency(settings.defaultCurrency);
    setRevenueSharePercent(settings.revenueSharePercent);
    setTaxDeductionAmount(settings.taxDeductionAmount);
    setTaxRatePercent(settings.taxRatePercent);
    setVgenPercent(settings.feeRules.vgenPercent);
    setPaypalPercent(settings.feeRules.paypalPercent);
    setPaypalFixed(settings.feeRules.paypalFixed);
  }, [settings]);

  if (!ready || !settings) return <p>Loading…</p>;

  const save = async () => {
    await saveSettings({
      startingOrderNumber: Number(startingOrderNumber),
      defaultCurrency,
      revenueSharePercent,
      taxDeductionAmount,
      taxRatePercent,
      feeRules: {
        vgenPercent,
        paypalPercent,
        paypalFixed,
        paypalFixedCurrency: "USD",
      },
    });
    await refreshSettings();
    setMessage("Settings saved. Existing order numbers are unchanged.");
  };

  const handleExport = async () => {
    const payload = await exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    let payload: BackupPayload;
    try {
      payload = JSON.parse(text) as BackupPayload;
    } catch {
      setMessage("Invalid JSON backup file.");
      return;
    }
    if (
      !confirm(
        "Replace all local ArtLedger data with this backup? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      await importBackup(payload);
      await refreshSettings();
      setMessage("Backup restored successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex flex-col gap-1">
        <SectionHeading
          as="h1"
          className="text-[24px] font-bold tracking-tight"
          info="Configure order numbering, default currency, fee estimate rules, tax planning assumptions, opening balances, and JSON backup/restore. All ArtLedger data stays in this browser unless you export a backup."
        >
          Settings
        </SectionHeading>
        <p className="text-[13px] text-on-surface-variant">
          Configure numbering, fees, tax assumptions, and local backups.
        </p>
      </div>

      <Card className="p-4 bg-surface-container-low shadow-none">
        <p className="text-[12px] text-on-surface-variant leading-relaxed">
          ArtLedger stores all financial data in this browser via IndexedDB. Clearing
          site data, switching browsers or devices, or changing the deployment domain
          can make records unavailable. Export backups regularly.
        </p>
      </Card>

      {message ? (
        <p className="text-[12px] rounded bg-surface-container px-3 py-2">{message}</p>
      ) : null}

      <Card className="p-5 flex flex-col gap-3">
        <SectionHeading
          className="font-semibold text-[15px]"
          info="Sets the next order/OR number for new income, the default currency on forms, and the revenue-share percentage used on the Dashboard. Changing the starting number does not renumber existing transactions."
        >
          Order numbering & defaults
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Starting order number">
            <Input
              value={startingOrderNumber}
              onChange={(e) => setStartingOrderNumber(e.target.value)}
            />
          </Field>
          <Field label="Next assigned number (read-only)">
            <Input value={String(settings.nextOrderNumber)} readOnly />
          </Field>
          <Field label="Default currency">
            <Select
              value={defaultCurrency}
              onChange={(e) =>
                setDefaultCurrency(e.target.value as CurrencyCode)
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Revenue share %">
            <Input
              value={revenueSharePercent}
              onChange={(e) => setRevenueSharePercent(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <SectionHeading
          className="font-semibold text-[15px]"
          info="Default VGen and PayPal fee rates used to estimate platform fees when you record income. The fee amounts you save on each transaction still control books and balances — these rules only prefill estimates."
        >
          Fee rules (estimates)
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="VGen %">
            <Input value={vgenPercent} onChange={(e) => setVgenPercent(e.target.value)} />
          </Field>
          <Field label="PayPal %">
            <Input
              value={paypalPercent}
              onChange={(e) => setPaypalPercent(e.target.value)}
            />
          </Field>
          <Field label="PayPal fixed (USD)">
            <Input value={paypalFixed} onChange={(e) => setPaypalFixed(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <SectionHeading
          className="font-semibold text-[15px]"
          info="Annual PHP deduction and flat tax rate used for estimated tax on the Dashboard and Tax Summary. These are planning assumptions for personal reference — not an official BIR computation or filed return."
        >
          Tax assumptions
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Annual deduction (PHP)">
            <Input
              value={taxDeductionAmount}
              onChange={(e) => setTaxDeductionAmount(e.target.value)}
            />
          </Field>
          <Field label="Tax rate %">
            <Input
              value={taxRatePercent}
              onChange={(e) => setTaxRatePercent(e.target.value)}
            />
          </Field>
        </div>
        <Button onClick={save}>Save settings</Button>
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <SectionHeading
          className="font-semibold text-[15px]"
          info="Starting cash you already held in each currency before using ArtLedger. Opening balances seed Currency Balances and are not treated as income or expenses."
        >
          Opening balances
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Currency">
            <Select
              value={obCurrency}
              onChange={(e) => setObCurrency(e.target.value as CurrencyCode)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount">
            <Input value={obAmount} onChange={(e) => setObAmount(e.target.value)} />
          </Field>
          <Field label="Effective date">
            <Input
              type="date"
              value={obDate}
              onChange={(e) => setObDate(e.target.value)}
            />
          </Field>
          <Field label="Account / location (optional)">
            <Input
              value={obLocation}
              onChange={(e) => setObLocation(e.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            if (!obAmount) return;
            await createOpeningBalance({
              currency: obCurrency,
              amount: obAmount,
              effectiveDate: obDate,
              accountLocation: obLocation || null,
            });
            setObAmount("");
          }}
        >
          Add opening balance
        </Button>
        <ul className="text-[12px] space-y-1">
          {openingBalances.map((ob) => (
            <li
              key={ob.id}
              className="flex justify-between bg-surface-container-low rounded px-3 py-2"
            >
              <span>
                {formatMoney(ob.amount, ob.currency)} · {ob.effectiveDate}
                {ob.accountLocation ? ` · ${ob.accountLocation}` : ""}
              </span>
              <button
                type="button"
                className="text-error"
                onClick={() => deleteOpeningBalance(ob.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 flex flex-col gap-3">
        <SectionHeading
          className="font-semibold text-[15px]"
          info="Export a full JSON copy of this browser’s ArtLedger data, or import a backup to replace all local records. Restoring overwrites current data and cannot be undone — export first if you need a safety copy."
        >
          Backup & restore
        </SectionHeading>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport}>Export JSON backup</Button>
          <label className="inline-flex">
            <span className="sr-only">Import backup</span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              id="backup-import"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => document.getElementById("backup-import")?.click()}
            >
              Import backup
            </Button>
          </label>
        </div>
      </Card>
    </div>
  );
}
