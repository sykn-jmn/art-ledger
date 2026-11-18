import { z } from "zod";

export const currencySchema = z.enum([
  "USD",
  "PHP",
  "EUR",
  "JPY",
  "GBP",
  "CAD",
  "AUD",
  "SGD",
]);

export const paymentMethodSchema = z.enum([
  "vgen_paypal",
  "vgen_stripe",
  "paypal_only",
  "gcash",
  "bank_transfer",
  "wise",
]);

export const expenseCategorySchema = z.enum([
  "tools_brushes",
  "software",
  "other_business",
  "monthly_revenue_share",
  "owners_drawings",
  "other_disbursements",
  "internal_transfer",
]);

export const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,8})?$/, "Enter a valid amount")
  .refine((v) => Number(v) >= 0, "Amount must be ≥ 0");

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const incomeFormSchema = z.object({
  paymentDate: dateSchema,
  clientName: z.string().trim().min(1, "Client name is required"),
  description: z.string().trim().min(1, "Description is required"),
  orderNumberOverride: z.string().trim().optional(),
  currency: currencySchema,
  grossAmount: moneySchema,
  paymentMethod: paymentMethodSchema,
  feeOverrides: z
    .object({
      vgen: z.string().optional(),
      paypal: z.string().optional(),
      stripe: z.string().optional(),
      wise: z.string().optional(),
      other: z.string().optional(),
    })
    .optional(),
  phpTaxValuation: z.string().optional(),
  phpValuationRate: z.string().optional(),
  phpValuationSource: z.string().optional(),
});

export const expenseFormSchema = z.object({
  paymentDate: dateSchema,
  payee: z.string().trim().min(1, "Payee is required"),
  description: z.string().trim().min(1, "Description is required"),
  category: expenseCategorySchema,
  currency: currencySchema,
  amount: moneySchema,
  paymentMethod: z.union([paymentMethodSchema, z.literal("other")]),
  referenceNumber: z.string().trim().optional(),
});

export const conversionFormSchema = z
  .object({
    conversionDate: dateSchema,
    sourceCurrency: currencySchema,
    sourceAmount: moneySchema,
    destinationCurrency: currencySchema,
    destinationAmount: moneySchema,
    exchangeRate: z.string().optional(),
    conversionFee: moneySchema.or(z.literal("")).transform((v) => v || "0"),
    conversionFeeCurrency: currencySchema,
    feeTreatment: z.enum(["from_source", "from_destination", "separate"]),
    referenceNumber: z.string().trim().optional(),
  })
  .refine((v) => v.sourceCurrency !== v.destinationCurrency, {
    message: "Source and destination currencies must differ",
    path: ["destinationCurrency"],
  });

export const settingsFormSchema = z.object({
  startingOrderNumber: z.coerce.number().int().min(0),
  defaultCurrency: currencySchema,
  revenueSharePercent: moneySchema,
  taxDeductionAmount: moneySchema,
  taxRatePercent: moneySchema,
  feeRules: z.object({
    vgenPercent: moneySchema,
    paypalPercent: moneySchema,
    paypalFixed: moneySchema,
    paypalFixedCurrency: currencySchema,
  }),
});

export const taxPaymentSchema = z.object({
  taxYear: z.coerce.number().int().min(2000).max(2100),
  period: z.enum(["Q1", "Q2", "Q3", "Q4", "annual"]),
  paymentDate: dateSchema,
  amountPaid: moneySchema,
  reference: z.string().optional(),
});

export const openingBalanceSchema = z.object({
  currency: currencySchema,
  amount: moneySchema,
  effectiveDate: dateSchema,
  accountLocation: z.string().optional(),
});

export const quickEntryRowSchema = z.object({
  tempId: z.string(),
  type: z.enum(["income", "expense", "conversion"]),
  date: dateSchema,
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().min(1, "Description is required"),
  amount: moneySchema,
  currency: currencySchema,
  paymentMethod: paymentMethodSchema.optional(),
  category: expenseCategorySchema.optional(),
  fees: z.string().optional(),
  referenceNumber: z.string().optional(),
  destinationCurrency: currencySchema.optional(),
  destinationAmount: z.string().optional(),
  conversionFee: z.string().optional(),
  phpTaxValuation: z.string().optional(),
});

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type ConversionFormValues = z.infer<typeof conversionFormSchema>;
export type QuickEntryRowValues = z.infer<typeof quickEntryRowSchema>;
