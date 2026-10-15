import { Transaction, TransactionType } from '@/types/finance';

/**
 * AI Money Tracker — Ledger Balance Calculator
 * 
 * Educational Concept: The Ledger Pattern
 * In banking and resilient financial systems, balance is NEVER stored as a mutable,
 * standalone number that gets updated randomly. Instead, balance is a DERIVED value:
 * 
 * Current Balance = Opening Balance + Income + Refunds - Expenses
 * 
 * If a transaction is deleted, edited, or corrected, the balance is recomputed
 * with 100% mathematical integrity and zero state drift.
 */

export interface CycleSummary {
  currentBalancePaise: number;
  totalIncomePaise: number;
  totalExpensePaise: number;
  totalRefundPaise: number;
  transactionCount: number;
}

/**
 * Resolves active transactions by excluding superseded transactions if a correction exists.
 */
export function getEffectiveTransactions(transactions: Transaction[]): Transaction[] {
  // Collect IDs of transactions that have been superseded by a correction
  const supersededIds = new Set<string>();
  for (const tx of transactions) {
    if (tx.isCorrection && tx.correctedFromId) {
      supersededIds.add(tx.correctedFromId);
    }
  }

  // Filter out any superseded transactions
  return transactions.filter(tx => !supersededIds.has(tx.id));
}

/**
 * Calculates current balance from an opening balance and a list of transactions.
 * Automatically resolves corrections and respects transaction types.
 */
export function calculateLedgerBalance(
  openingBalancePaise: number,
  transactions: Transaction[]
): number {
  const effectiveTransactions = getEffectiveTransactions(transactions);

  let balance = openingBalancePaise;

  for (const tx of effectiveTransactions) {
    switch (tx.type) {
      case 'income':
      case 'refund':
        balance += tx.amountPaise;
        break;
      case 'expense':
        balance -= tx.amountPaise;
        break;
      default:
        // Defensive check: ignore unrecognized transaction types
        break;
    }
  }

  return balance;
}

/**
 * Computes a full statistical breakdown of a cycle's transactions.
 */
export function calculateCycleSummary(
  openingBalancePaise: number,
  transactions: Transaction[]
): CycleSummary {
  const effective = getEffectiveTransactions(transactions);

  let totalIncome = 0;
  let totalExpense = 0;
  let totalRefund = 0;

  for (const tx of effective) {
    if (tx.type === 'income') totalIncome += tx.amountPaise;
    else if (tx.type === 'expense') totalExpense += tx.amountPaise;
    else if (tx.type === 'refund') totalRefund += tx.amountPaise;
  }

  const currentBalance = openingBalancePaise + totalIncome + totalRefund - totalExpense;

  return {
    currentBalancePaise: currentBalance,
    totalIncomePaise: totalIncome,
    totalExpensePaise: totalExpense,
    totalRefundPaise: totalRefund,
    transactionCount: effective.length,
  };
}

/**
 * Filters a list of transactions belonging to a specific date range [startDate, endDate).
 * Dates are ISO string format: YYYY-MM-DD.
 */
export function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): Transaction[] {
  return transactions.filter(tx => {
    return tx.transactionDate >= startDate && tx.transactionDate < endDate;
  });
}
