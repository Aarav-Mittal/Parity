import { Category, Transaction } from '@/types/finance';
import { CategorySpendSummary, MonthlyAnalyticsSummary } from '@/types/alerts';
import { getEffectiveTransactions } from './ledger';

export function calculateCategorySpending(
  transactions: Transaction[],
  categories: Category[],
  cycleStartISO?: string
): MonthlyAnalyticsSummary {
  // Only look at active non-superseded transactions
  const effective = getEffectiveTransactions(transactions);

  // Filter for expenses within the current cycle if cycleStartISO is provided
  const cycleExpenses = effective.filter(tx => {
    if (tx.type !== 'expense') return false;
    if (cycleStartISO && tx.transactionDate < cycleStartISO) return false;
    return true;
  });

  const categoryMap = new Map<string, Category>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  // Aggregate spent paise and counts per category
  const spendMap = new Map<string, { totalPaise: number; count: number }>();
  let grandTotalSpentPaise = 0;

  for (const tx of cycleExpenses) {
    const catId = tx.categoryId || 'cat-misc';
    const current = spendMap.get(catId) || { totalPaise: 0, count: 0 };
    current.totalPaise += tx.amountPaise;
    current.count += 1;
    spendMap.set(catId, current);
    grandTotalSpentPaise += tx.amountPaise;
  }

  // Build sorted summary array
  const summaries: CategorySpendSummary[] = [];

  for (const [catId, stats] of spendMap.entries()) {
    const cat = categoryMap.get(catId) || {
      id: catId,
      name: 'Miscellaneous',
      colorHex: '#64748B',
      icon: 'MoreHorizontal',
    };

    const percentage = grandTotalSpentPaise > 0
      ? Math.round((stats.totalPaise / grandTotalSpentPaise) * 1000) / 10
      : 0;

    summaries.push({
      categoryId: catId,
      categoryName: cat.name,
      categoryColorHex: cat.colorHex || '#64748B',
      categoryIcon: cat.icon || 'Tag',
      totalSpentPaise: stats.totalPaise,
      percentageOfTotal: percentage,
      transactionCount: stats.count,
    });
  }

  // Sort descending by highest spent
  summaries.sort((a, b) => b.totalSpentPaise - a.totalSpentPaise);

  return {
    totalSpentPaise: grandTotalSpentPaise,
    categories: summaries,
    topCategory: summaries.length > 0 ? summaries[0] : undefined,
  };
}
