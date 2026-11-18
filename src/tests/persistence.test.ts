import { beforeEach, describe, expect, it } from "vitest";
import {
  createIncome,
  deleteIncome,
  exportBackup,
  importBackup,
  updateIncome,
} from "@/db/transactions";
import { ensureSettings, getDb, resetDbInstance } from "@/db/database";

describe("persistence", () => {
  beforeEach(async () => {
    resetDbInstance();
    const db = getDb();
    await db.delete();
    resetDbInstance();
    await ensureSettings();
  });

  it("creates, reloads, edits, and deletes income with fee records", async () => {
    const created = await createIncome({
      paymentDate: "2024-05-01",
      clientName: "Studio",
      description: "Portrait",
      currency: "USD",
      grossAmount: "100.00",
      paymentMethod: "vgen_paypal",
      phpTaxValuation: "5600.00",
    });
    expect(created.orderNumber).toBe("000001");

    const db = getDb();
    const loaded = await db.incomes.get(created.id);
    expect(loaded?.clientName).toBe("Studio");
    const fees = await db.fees.where("transactionId").equals(created.id).toArray();
    expect(fees.length).toBeGreaterThan(0);

    const updated = await updateIncome(created.id, {
      paymentDate: "2024-05-01",
      clientName: "Studio Updated",
      description: "Portrait",
      currency: "USD",
      grossAmount: "100.00",
      paymentMethod: "vgen_paypal",
      phpTaxValuation: "5600.00",
      orderNumberOverride: created.orderNumber,
    });
    expect(updated.orderNumber).toBe(created.orderNumber);
    expect(updated.clientName).toBe("Studio Updated");

    await deleteIncome(created.id);
    expect(await db.incomes.get(created.id)).toBeUndefined();
    expect(
      await db.fees.where("transactionId").equals(created.id).count(),
    ).toBe(0);

    // Deleted order number not reused for next create if nextOrderNumber advanced
    const next = await createIncome({
      paymentDate: "2024-05-02",
      clientName: "Other",
      description: "Work",
      currency: "USD",
      grossAmount: "50.00",
      paymentMethod: "gcash",
      phpTaxValuation: "2800.00",
    });
    expect(next.orderNumber).toBe("000002");
  });

  it("exports and imports backup atomically", async () => {
    await createIncome({
      paymentDate: "2024-06-01",
      clientName: "Backup Client",
      description: "Art",
      currency: "PHP",
      grossAmount: "1000.00",
      paymentMethod: "gcash",
    });
    const backup = await exportBackup();
    expect(backup.incomes).toHaveLength(1);
    expect(backup.schemaVersion).toBe(1);

    const db = getDb();
    await db.incomes.clear();
    expect(await db.incomes.count()).toBe(0);

    await importBackup(backup);
    expect(await db.incomes.count()).toBe(1);
    const row = (await db.incomes.toArray())[0];
    expect(row?.clientName).toBe("Backup Client");
  });

  it("rejects corrupt backup without partial import", async () => {
    await createIncome({
      paymentDate: "2024-06-01",
      clientName: "Keep",
      description: "Art",
      currency: "PHP",
      grossAmount: "1000.00",
      paymentMethod: "gcash",
    });
    await expect(
      importBackup({} as never),
    ).rejects.toThrow();
    const db = getDb();
    expect(await db.incomes.count()).toBe(1);
  });
});
