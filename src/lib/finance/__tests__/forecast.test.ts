import { describe, it, expect } from 'vitest';
import {
  calculateForecast,
  isRecurringExpensePaidInCycle,
  getUpcomingCommittedBills,
  calculateSpendingVelocity,
} from '../forecast';
import { AllowanceCycle, Transaction, RecurringExpense } from '@/types/finance';

describe('Deterministic Forecasting Engine', () => {
  const mockCycle: AllowanceCycle = {
    id: 'cycle-1',
    userId: 'user-1',
    allowanceAmountPaise: 800000, // ₹8,000
    cycleDayOfMonth: 1,
    currentCycleStart: '2026-10-01',
    nextPayoutDate: '2026-11-01',
    openingBalancePaise: 800000,
    targetReservePaise: 50000, // ₹500
    isActive: true,
  };

  it('handles cold-start / new user without fabricating spending history', () => {
    const today = '2026-10-01'; // Day 1 of cycle, 31 days remaining
    const transactions: Transaction[] = [];
    const recurringExpenses: RecurringExpense[] = [];

    const forecast = calculateForecast({
      todayISO: today,
      cycle: mockCycle,
      transactions,
      recurringExpenses,
    });

    expect(forecast.currentBalancePaise).toBe(800000); // ₹8,000
    expect(forecast.daysRemaining).toBe(31);
    expect(forecast.isDataSufficient).toBe(false); // Transparently reports lack of data

    // Discretionary pool = 800,000 - 0 (bills) - 50,000 (reserve) = 750,000 paise
    // Safe daily spend = 750,000 / 31 = 24,193 paise (approx ₹241.93 -> rounded down to 24193)
    expect(forecast.safeDailySpendPaise).toBe(Math.floor(750000 / 31));
    expect(forecast.status).toBe('safe');
    expect(forecast.projectedRunOutDate).toBeNull();
  });

  it('accurately accounts for upcoming recurring bills in safe daily spend', () => {
    const today = '2026-10-15'; // 17 days remaining
    const transactions: Transaction[] = [];
    const recurringExpenses: RecurringExpense[] = [
      {
        id: 'rec-1',
        userId: 'user-1',
        name: 'Wi-Fi',
        amountPaise: 50000, // ₹500
        frequency: 'monthly',
        dueDayOfMonth: 20,
        nextDueDate: '2026-10-20',
        isPaused: false,
      },
      {
        id: 'rec-2',
        userId: 'user-1',
        name: 'Hostel Rent',
        amountPaise: 200000, // ₹2,000
        frequency: 'monthly',
        dueDayOfMonth: 25,
        nextDueDate: '2026-10-25',
        isPaused: false,
      },
    ];

    const forecast = calculateForecast({
      todayISO: today,
      cycle: mockCycle,
      transactions,
      recurringExpenses,
    });

    // Total committed bills = ₹500 + ₹2,000 = ₹2,500 (250000 paise)
    expect(forecast.committedBillsPaise).toBe(250000);

    // Discretionary pool = 800000 - 250000 (bills) - 50000 (reserve) = 500000 paise (₹5,000)
    expect(forecast.discretionaryPoolPaise).toBe(500000);

    // Safe daily spend = 500000 / 17 days = 29411 paise (approx ₹294)
    expect(forecast.safeDailySpendPaise).toBe(Math.floor(500000 / 17));
  });

  it('prevents double-counting recurring bills that have already been paid in current cycle', () => {
    const today = '2026-10-15';
    const recurringExpenses: RecurringExpense[] = [
      {
        id: 'rec-1',
        userId: 'user-1',
        name: 'Hostel Rent',
        amountPaise: 200000, // ₹2,000
        frequency: 'monthly',
        dueDayOfMonth: 5,
        nextDueDate: '2026-11-05',
        isPaused: false,
        lastPaidDate: '2026-10-05', // Already paid this cycle!
      },
    ];

    const { totalCommittedPaise } = getUpcomingCommittedBills(
      recurringExpenses,
      today,
      mockCycle.nextPayoutDate,
      mockCycle.currentCycleStart
    );

    // Since it was already marked paid on Oct 5th, committed bills should be 0!
    expect(totalCommittedPaise).toBe(0);
  });

  it('predicts money run-out date when user spends faster than allowance allows (danger status)', () => {
    const today = '2026-10-20'; // 12 days left until Nov 1
    const cycleWithLowerBalance: AllowanceCycle = {
      ...mockCycle,
      openingBalancePaise: 250000, // ₹2,500
    };

    // Recent 3 days of high spending: ₹600/day
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 60000, // ₹600
        description: 'Dinner party',
        transactionDate: '2026-10-18',
        createdAt: '2026-10-18T19:00:00Z',
      },
      {
        id: 'tx-2',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 60000, // ₹600
        description: 'Shopping',
        transactionDate: '2026-10-19',
        createdAt: '2026-10-19T14:00:00Z',
      },
      {
        id: 'tx-3',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 60000, // ₹600
        description: 'Cafe & outing',
        transactionDate: '2026-10-20',
        createdAt: '2026-10-20T16:00:00Z',
      },
    ];

    const forecast = calculateForecast({
      todayISO: today,
      cycle: cycleWithLowerBalance,
      transactions,
      recurringExpenses: [],
    });

    // Current balance = 2,500 - 1,800 = ₹700 (70000 paise)
    expect(forecast.currentBalancePaise).toBe(70000);
    // At ₹600/day burn rate, ₹700 will run out within 2 days!
    expect(forecast.status).toBe('danger');
    expect(forecast.projectedRunOutDate).not.toBeNull();
    expect(forecast.statusHeadline).toContain('Projected shortfall');
  });

  it('flags tight status when balance survives but breaches minimum reserve', () => {
    const today = '2026-10-25'; // 7 days left
    const cycle: AllowanceCycle = {
      ...mockCycle,
      openingBalancePaise: 160000, // ₹1,600
      targetReservePaise: 50000,   // ₹500 reserve cushion
    };

    // Spending ₹150/day (150 * 7 days = ₹1,050). Remaining balance at end = ₹150, which is < ₹500 reserve!
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 15000,
        description: 'Meals',
        transactionDate: '2026-10-23',
        createdAt: '2026-10-23T12:00:00Z',
      },
      {
        id: 'tx-2',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 15000,
        description: 'Meals',
        transactionDate: '2026-10-24',
        createdAt: '2026-10-24T12:00:00Z',
      },
      {
        id: 'tx-3',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 15000,
        description: 'Meals',
        transactionDate: '2026-10-25',
        createdAt: '2026-10-25T12:00:00Z',
      },
    ];

    const forecast = calculateForecast({
      todayISO: today,
      cycle,
      transactions,
      recurringExpenses: [],
    });

    // Balance does not go below zero, but breaches reserve -> tight
    expect(forecast.status).toBe('tight');
    expect(forecast.projectedRunOutDate).toBeNull();
  });

  it('validates the complete realistic student persona (Aryan - DU sophomore)', () => {
    const today = '2026-10-15'; // Mid-cycle: 17 days remaining
    const aryanCycle: AllowanceCycle = {
      id: 'aryan-cycle',
      userId: 'aryan-123',
      allowanceAmountPaise: 800000, // ₹8,000 monthly allowance
      cycleDayOfMonth: 1,
      currentCycleStart: '2026-10-01',
      nextPayoutDate: '2026-11-01',
      openingBalancePaise: 800000,
      targetReservePaise: 50000, // ₹500 reserve
      isActive: true,
    };

    // 3 recurring commitments: Rent, Wi-Fi, Mobile recharge
    const aryanRecurring: RecurringExpense[] = [
      {
        id: 'rec-rent',
        userId: 'aryan-123',
        name: 'Room Rent',
        amountPaise: 250000, // ₹2,500
        frequency: 'monthly',
        dueDayOfMonth: 5,
        nextDueDate: '2026-11-05',
        isPaused: false,
        lastPaidDate: '2026-10-05', // Already paid on Oct 5!
      },
      {
        id: 'rec-wifi',
        userId: 'aryan-123',
        name: 'Hostel Wi-Fi',
        amountPaise: 49900, // ₹499
        frequency: 'monthly',
        dueDayOfMonth: 10,
        nextDueDate: '2026-11-10',
        isPaused: false,
        lastPaidDate: '2026-10-10', // Already paid on Oct 10!
      },
      {
        id: 'rec-recharge',
        userId: 'aryan-123',
        name: 'Mobile Recharge',
        amountPaise: 29900, // ₹299
        frequency: 'monthly',
        dueDayOfMonth: 20,
        nextDueDate: '2026-10-20',
        isPaused: false,
        lastPaidDate: null, // NOT yet paid! Due in 5 days
      },
    ];

    // Transactions logged up to Oct 15
    const aryanTransactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'aryan-123',
        type: 'expense',
        amountPaise: 250000, // Rent
        description: 'Room Rent',
        transactionDate: '2026-10-05',
        createdAt: '2026-10-05T10:00:00Z',
        recurringExpenseId: 'rec-rent',
      },
      {
        id: 'tx-2',
        userId: 'aryan-123',
        type: 'expense',
        amountPaise: 49900, // Wi-Fi
        description: 'Hostel Wi-Fi',
        transactionDate: '2026-10-10',
        createdAt: '2026-10-10T11:00:00Z',
        recurringExpenseId: 'rec-wifi',
      },
      {
        id: 'tx-3',
        userId: 'aryan-123',
        type: 'expense',
        amountPaise: 80100, // Canteen & stationery
        description: 'Canteen & Books',
        transactionDate: '2026-10-14',
        createdAt: '2026-10-14T15:00:00Z',
      },
    ];

    const forecast = calculateForecast({
      todayISO: today,
      cycle: aryanCycle,
      transactions: aryanTransactions,
      recurringExpenses: aryanRecurring,
    });

    // 1. Current balance: 800000 - 250000 - 49900 - 80100 = 420000 paise (₹4,200)
    expect(forecast.currentBalancePaise).toBe(420000);

    // 2. Upcoming committed bills: Only the unpaid mobile recharge of ₹299 (29900 paise)
    // Rent and Wi-Fi are already marked paid in this cycle and must NOT be double counted!
    expect(forecast.committedBillsPaise).toBe(29900);

    // 3. Discretionary pool: 420000 - 29900 (recharge) - 50000 (reserve) = 340100 paise (₹3,401)
    expect(forecast.discretionaryPoolPaise).toBe(340100);

    // 4. Days remaining: Oct 15 to Nov 1 = 17 days
    expect(forecast.daysRemaining).toBe(17);

    // 5. Safe daily spend: floor(340100 / 17) = 20005 paise (~₹200/day)
    expect(forecast.safeDailySpendPaise).toBe(Math.floor(340100 / 17));

    // 6. Aryan is on track!
    expect(forecast.status).toBe('safe');
    expect(forecast.projectedRunOutDate).toBeNull();
  });

  it('handles edge case: zero days remaining (payout day)', () => {
    const today = '2026-11-01'; // Exactly on payout day
    const forecast = calculateForecast({
      todayISO: today,
      cycle: mockCycle,
      transactions: [],
      recurringExpenses: [],
    });

    expect(forecast.daysRemaining).toBe(0);
    expect(forecast.statusHeadline).toContain('Allowance payout day');
    expect(forecast.projectedRunOutDate).toBeNull();
  });

  it('handles edge case: negative starting balance (current deficit)', () => {
    const today = '2026-10-15';
    // User overspent: opening balance ₹1,000, spent ₹1,500
    const overspentTransactions: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'user-1',
        type: 'expense',
        amountPaise: 150000,
        description: 'Big emergency',
        transactionDate: '2026-10-10',
        createdAt: '2026-10-10T12:00:00Z',
      },
    ];
    const cycleWithSmallBalance: AllowanceCycle = {
      ...mockCycle,
      openingBalancePaise: 100000, // ₹1,000
    };

    const forecast = calculateForecast({
      todayISO: today,
      cycle: cycleWithSmallBalance,
      transactions: overspentTransactions,
      recurringExpenses: [],
    });

    expect(forecast.currentBalancePaise).toBe(-50000); // -₹500
    expect(forecast.status).toBe('danger');
    expect(forecast.safeDailySpendPaise).toBe(0);
    expect(forecast.statusHeadline).toContain('Balance in deficit');
    expect(forecast.projectedRunOutDate).toBe('2026-10-15');
  });

  it('handles edge case: passed cycle date', () => {
    const today = '2026-11-05'; // 4 days past next payout date of Nov 1
    const forecast = calculateForecast({
      todayISO: today,
      cycle: mockCycle,
      transactions: [],
      recurringExpenses: [],
    });

    expect(forecast.statusHeadline).toContain('Cycle completed');
  });
});
