import type { ExpenseTransaction, IncomeTransaction } from "@/types";
import { getMonthIndex, getYear } from "@/lib/utils/dates";
import { add, d, money, mul, sub } from "@/lib/utils/money";
import { incomePhpGross } from "@/lib/calculations/taxes";

export interface RevenueShareMonth {
  monthIndex: number;
  monthName: string;
  monthlyGross: string;
  calculatedShare: string;
  actualPaid: string;
  outstanding: string;
}

/**
 * Calculated revenue share is informational only — it never creates a payment.
 * Actual payments come from expense transactions categorized as monthly_revenue_share.
 */
export function calculateRevenueShare(params: {
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  year: number;
  percent: string;
}): RevenueShareMonth[] {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return names.map((monthName, monthIndex) => {
    let gross = d(0);
    for (const income of params.incomes) {
      if (getYear(income.paymentDate) !== params.year) continue;
      if (getMonthIndex(income.paymentDate) !== monthIndex) continue;
      const { amount, missing } = incomePhpGross(income);
      if (!missing) gross = gross.plus(d(amount));
    }

    const monthlyGross = money(gross);
    const calculatedShare = mul(monthlyGross, d(params.percent).div(100));

    const actualPaid = money(
      params.expenses
        .filter(
          (e) =>
            e.category === "monthly_revenue_share" &&
            getYear(e.paymentDate) === params.year &&
            getMonthIndex(e.paymentDate) === monthIndex,
        )
        .reduce((sum, e) => {
          // Prefer PHP; if foreign, still sum nominal (MVP: assume PHP for share payments)
          if (e.currency === "PHP") return add(sum, e.amount);
          return add(sum, e.amount);
        }, "0.00"),
    );

    return {
      monthIndex,
      monthName,
      monthlyGross,
      calculatedShare,
      actualPaid,
      outstanding: money(sub(calculatedShare, actualPaid)),
    };
  });
}
