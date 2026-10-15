'use client';

import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { useMoney } from '@/lib/store/MoneyContext';
import { calculateCategorySpending } from '@/lib/finance/analytics';
import { formatPaiseToINR } from '@/lib/finance/currency';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { PieChart, TrendingUp } from 'lucide-react';

export function CategoryBreakdownCard() {
  const { transactions, categories, cycle } = useMoney();

  const cycleStart = cycle?.currentCycleStart;
  const analytics = calculateCategorySpending(transactions, categories, cycleStart);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-slate-500" />
            <CardTitle>Spending by Category</CardTitle>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total: {formatPaiseToINR(analytics.totalSpentPaise)}
          </span>
        </div>
      </CardHeader>

      {analytics.categories.length === 0 || analytics.totalSpentPaise === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          No expenses recorded in this cycle yet. Log your daily spending to see where your money goes.
        </div>
      ) : (
        <div className="space-y-3.5">
          {analytics.topCategory && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                Top Expense: <strong className="text-slate-900">{analytics.topCategory.categoryName}</strong>
              </span>
              <span className="font-semibold text-indigo-700">
                {analytics.topCategory.percentageOfTotal}% of spend
              </span>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {analytics.categories.map(cat => (
              <div key={cat.categoryId} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CategoryIcon
                      iconName={cat.categoryIcon}
                      colorHex={cat.categoryColorHex}
                      className="h-3.5 w-3.5"
                    />
                    <span className="font-medium text-slate-900">
                      {cat.categoryName}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({cat.transactionCount} {cat.transactionCount === 1 ? 'txn' : 'txns'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {formatPaiseToINR(cat.totalSpentPaise)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 w-11 text-right">
                      {cat.percentageOfTotal}%
                    </span>
                  </div>
                </div>

                {/* Progress / Percentage bar */}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, cat.percentageOfTotal))}%`,
                      backgroundColor: cat.categoryColorHex || '#6366f1',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
