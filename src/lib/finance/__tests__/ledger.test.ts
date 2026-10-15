import { describe, it, expect } from 'vitest';
import {
  calculateLedgerBalance,
  calculateCycleSummary,
  getEffectiveTransactions,
} from '../ledger';
import { Transaction } from '@/types/finance';

describe('Ledger Engine', () => {
  const baseTransaction: Omit<Transaction, 'id' | 'type' | 'amountPaise'> = {
    userId: 'user-1',
    description: 'Test',
    transactionDate: '2026-10-15',
    createdAt: '2026-10-15T10:00:00Z',
  };

  it('calculates balance correctly with ordinary expenses and income', () => {
    const openingBalance = 800000; // ₹8,000
    const transactions: Transaction[] = [
      { ...baseTransaction, id: 'tx-1', type: 'expense', amountPaise: 50000, description: 'Lunch' }, // -₹500
      { ...baseTransaction, id: 'tx-2', type: 'expense', amountPaise: 12000, description: 'Auto' },  // -₹120
      { ...baseTransaction, id: 'tx-3', type: 'income', amountPaise: 200000, description: 'Stipend' }, // +₹2,000
    ];

    // 8,000 - 500 - 120 + 2,000 = 9,380 -> 938000 paise
    const balance = calculateLedgerBalance(openingBalance, transactions);
    expect(balance).toBe(938000);
  });

  it('handles refunds by crediting them to balance', () => {
    const openingBalance = 500000; // ₹5,000
    const transactions: Transaction[] = [
      { ...baseTransaction, id: 'tx-1', type: 'expense', amountPaise: 80000, description: 'T-shirt' }, // -₹800
      { ...baseTransaction, id: 'tx-2', type: 'refund', amountPaise: 80000, description: 'Returned t-shirt' }, // +₹800
    ];

    const balance = calculateLedgerBalance(openingBalance, transactions);
    expect(balance).toBe(500000);
  });

  it('corrects a previous transaction without double-counting', () => {
    const openingBalance = 800000; // ₹8,000
    const transactions: Transaction[] = [
      { ...baseTransaction, id: 'tx-1', type: 'expense', amountPaise: 50000, description: 'Lunch' }, // Initial ₹500
      // User says: "Actually lunch was 450, not 500"
      {
        ...baseTransaction,
        id: 'tx-2',
        type: 'expense',
        amountPaise: 45000,
        description: 'Lunch (corrected)',
        isCorrection: true,
        correctedFromId: 'tx-1',
      },
    ];

    const effective = getEffectiveTransactions(transactions);
    expect(effective.length).toBe(1);
    expect(effective[0].id).toBe('tx-2');
    expect(effective[0].amountPaise).toBe(45000);

    // 8,000 - 450 = 7,550 -> 755000 paise
    const balance = calculateLedgerBalance(openingBalance, transactions);
    expect(balance).toBe(755000);
  });

  it('computes complete cycle summary totals', () => {
    const openingBalance = 1000000; // ₹10,000
    const transactions: Transaction[] = [
      { ...baseTransaction, id: 'tx-1', type: 'expense', amountPaise: 150000, description: 'Books' },
      { ...baseTransaction, id: 'tx-2', type: 'expense', amountPaise: 50000, description: 'Dinner' },
      { ...baseTransaction, id: 'tx-3', type: 'income', amountPaise: 300000, description: 'Project work' },
      { ...baseTransaction, id: 'tx-4', type: 'refund', amountPaise: 20000, description: 'Book discount' },
    ];

    const summary = calculateCycleSummary(openingBalance, transactions);
    expect(summary.totalExpensePaise).toBe(200000); // ₹2,000
    expect(summary.totalIncomePaise).toBe(300000);   // ₹3,000
    expect(summary.totalRefundPaise).toBe(20000);    // ₹200
    // 10,000 - 2,000 + 3,000 + 200 = 11,200 -> 1120000 paise
    expect(summary.currentBalancePaise).toBe(1120000);
    expect(summary.transactionCount).toBe(4);
  });
});
