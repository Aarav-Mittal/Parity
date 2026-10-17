import { describe, it, expect } from 'vitest';
import { checkRolloverStatus, executeCycleRollover } from '../rollover';
import { AllowanceCycle, RecurringExpense, Transaction } from '@/types/finance';
import { calculateLedgerBalance } from '../ledger';
import { isRecurringExpensePaidInCycle } from '../forecast';

describe('Allowance Month Rollover Engine', () => {
  const sampleCycle: AllowanceCycle = {
    id: 'cycle-oct-2026',
    userId: 'usr-1',
    allowanceAmountPaise: 800000, // ₹8,000
    cycleDayOfMonth: 1,
    currentCycleStart: '2026-10-01',
    nextPayoutDate: '2026-11-01',
    openingBalancePaise: 800000,
    targetReservePaise: 50000,
    isActive: true,
  };

  it('detects rollover is not due when today is before next payout date', () => {
    const status = checkRolloverStatus('2026-10-25', sampleCycle);
    expect(status).not.toBeNull();
    expect(status?.isDue).toBe(false);
    expect(status?.daysOverdue).toBe(0);
  });

  it('detects rollover is due on or after next payout date', () => {
    const statusOnDue = checkRolloverStatus('2026-11-01', sampleCycle);
    expect(statusOnDue?.isDue).toBe(true);
    expect(statusOnDue?.daysOverdue).toBe(0);
    expect(statusOnDue?.newCycleStart).toBe('2026-11-01');
    expect(statusOnDue?.newNextPayoutDate).toBe('2026-12-01');
    expect(statusOnDue?.cycleMonthLabel).toBe('November 2026');

    const statusOverdue = checkRolloverStatus('2026-11-03', sampleCycle);
    expect(statusOverdue?.isDue).toBe(true);
    expect(statusOverdue?.daysOverdue).toBe(2);
  });

  it('advances cycle dates correctly and creates allowance income transaction', () => {
    const result = executeCycleRollover({
      currentCycle: sampleCycle,
      todayISO: '2026-11-01',
      newAllowancePaise: 900000, // ₹9,000 allowance this month
    });

    expect(result.updatedCycle.currentCycleStart).toBe('2026-11-01');
    expect(result.updatedCycle.nextPayoutDate).toBe('2026-12-01');
    expect(result.updatedCycle.allowanceAmountPaise).toBe(900000);

    expect(result.newAllowanceTransaction.type).toBe('income');
    expect(result.newAllowanceTransaction.amountPaise).toBe(900000);
    expect(result.newAllowanceTransaction.description).toBe('November 2026 Allowance');
    expect(result.newAllowanceTransaction.transactionDate).toBe('2026-11-01');
  });

  it('preserves existing transaction ledger history and carries forward savings accurately', () => {
    // In October: Started with 8,000. Spent 5,000. Remaining: 3,000.
    const pastTransactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'usr-1',
        amountPaise: 300000,
        type: 'expense',
        description: 'Room Rent',
        transactionDate: '2026-10-05',
        isOneOff: false,
        isCorrection: false,
        correctedFromId: null,
        createdAt: '2026-10-05T00:00:00Z',
        categoryId: 'cat-rent',
      },
      {
        id: 'tx-2',
        userId: 'usr-1',
        amountPaise: 200000,
        type: 'expense',
        description: 'Groceries and food',
        transactionDate: '2026-10-20',
        isOneOff: false,
        isCorrection: false,
        correctedFromId: null,
        createdAt: '2026-10-20T00:00:00Z',
        categoryId: 'cat-food',
      },
    ];

    const endOfOctoberBalance = calculateLedgerBalance(sampleCycle.openingBalancePaise, pastTransactions);
    expect(endOfOctoberBalance).toBe(300000); // ₹3,000 remaining

    // Execute rollover into November with new ₹8,000 allowance
    const { updatedCycle, newAllowanceTransaction } = executeCycleRollover({
      currentCycle: sampleCycle,
      todayISO: '2026-11-01',
      newAllowancePaise: 800000,
    });

    const newTxWithId: Transaction = {
      ...newAllowanceTransaction,
      id: 'tx-nov-allowance',
      createdAt: '2026-11-01T00:00:00Z',
    };

    const combinedLedger = [...pastTransactions, newTxWithId];
    expect(combinedLedger.length).toBe(3); // October transactions preserved!

    // Balance in November = October opening (8,000) - Oct expenses (5,000) + Nov allowance (8,000) = 11,000
    const startOfNovemberBalance = calculateLedgerBalance(sampleCycle.openingBalancePaise, combinedLedger);
    expect(startOfNovemberBalance).toBe(1100000); // Exactly ₹11,000!
  });

  it('resets recurring bills paid status for the new cycle without mutating audit history', () => {
    const wifiBill: RecurringExpense = {
      id: 'rec-wifi',
      userId: 'usr-1',
      name: 'Wi-Fi broadband',
      amountPaise: 50000, // ₹500
      frequency: 'monthly',
      dueDayOfMonth: 10,
      nextDueDate: '2026-10-10',
      isPaused: false,
      lastPaidDate: '2026-10-10', // Paid in October
      categoryId: 'cat-bills',
    };

    // In October (cycle start 2026-10-01), the bill is recognized as PAID
    expect(isRecurringExpensePaidInCycle(wifiBill, '2026-10-01')).toBe(true);

    // In November (new cycle start 2026-11-01), the bill is recognized as UNPAID!
    expect(isRecurringExpensePaidInCycle(wifiBill, '2026-11-01')).toBe(false);
  });
});
