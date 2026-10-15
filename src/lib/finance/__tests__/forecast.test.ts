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

    // 7 days of steady ₹100/day spending (Oct 19 to Oct 25)
    // 7 * 100 = ₹700 spent. Current balance = 1,600 - 700 = ₹900.
    // Projected 7 days spend at ₹100/day = ₹700.
    // Projected end balance = 900 - 700 = ₹200, which stays positive but dips below ₹500 reserve -> tight!
    const transactions: Transaction[] = [
      { id: 'tx-1', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-19', createdAt: '2026-10-19T12:00:00Z' },
      { id: 'tx-2', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-20', createdAt: '2026-10-20T12:00:00Z' },
      { id: 'tx-3', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-21', createdAt: '2026-10-21T12:00:00Z' },
      { id: 'tx-4', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-22', createdAt: '2026-10-22T12:00:00Z' },
      { id: 'tx-5', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-23', createdAt: '2026-10-23T12:00:00Z' },
      { id: 'tx-6', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-24', createdAt: '2026-10-24T12:00:00Z' },
      { id: 'tx-7', userId: 'user-1', type: 'expense', amountPaise: 10000, description: 'Meals', transactionDate: '2026-10-25', createdAt: '2026-10-25T12:00:00Z' },
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

  describe('Intelligent One-Off and Weekend Expenditure Handling', () => {
    it('1. Accurately tracks ordinary living spending', () => {
      const today = '2026-10-10'; // 10 days elapsed
      // Steady ₹150/day across 10 days
      const transactions: Transaction[] = [];
      for (let i = 1; i <= 10; i++) {
        const dayStr = String(i).padStart(2, '0');
        transactions.push({
          id: `tx-${i}`,
          userId: 'user-1',
          type: 'expense',
          amountPaise: 15000, // ₹150
          description: 'Daily Food & Travel',
          transactionDate: `2026-10-${dayStr}`,
          createdAt: `2026-10-${dayStr}T12:00:00Z`,
        });
      }

      const forecast = calculateForecast({
        todayISO: today,
        cycle: mockCycle,
        transactions,
        recurringExpenses: [],
      });

      // 10 days * ₹150 = ₹1,500 spent. Balance = 8,000 - 1,500 = ₹6,500
      expect(forecast.currentBalancePaise).toBe(650000);
      expect(forecast.oneOffExpensesPaise).toBe(0); // Zero one-offs
      // Living velocity is exactly ₹150/day (15000 paise)
      expect(forecast.recentDailySpendPaise).toBe(15000);
      expect(forecast.status).toBe('safe');
    });

    it('2. Isolates a large one-off capital purchase without falsely spiking daily living velocity', () => {
      const today = '2026-10-10'; // 10 days elapsed
      // Days 1-7: ₹150/day
      // Day 8: ₹2,500 semester textbook
      // Days 9-10: ₹150/day
      const transactions: Transaction[] = [];
      for (let i = 1; i <= 10; i++) {
        const dayStr = String(i).padStart(2, '0');
        if (i === 8) {
          transactions.push({
            id: `tx-${i}`,
            userId: 'user-1',
            type: 'expense',
            amountPaise: 250000, // ₹2,500 one-off textbook
            description: 'Semester Textbook',
            transactionDate: `2026-10-${dayStr}`,
            createdAt: `2026-10-${dayStr}T12:00:00Z`,
            isOneOff: true,
          });
        } else {
          transactions.push({
            id: `tx-${i}`,
            userId: 'user-1',
            type: 'expense',
            amountPaise: 15000, // ₹150
            description: 'Meals',
            transactionDate: `2026-10-${dayStr}`,
            createdAt: `2026-10-${dayStr}T12:00:00Z`,
          });
        }
      }

      const forecast = calculateForecast({
        todayISO: today,
        cycle: mockCycle,
        transactions,
        recurringExpenses: [],
      });

      // 1. Ledger Balance MUST fully deduct the ₹2,500!
      // Total spent = (9 * 150) + 2,500 = ₹3,850.
      // Balance = 8,000 - 3,850 = ₹4,150 (415000 paise).
      expect(forecast.currentBalancePaise).toBe(415000);

      // 2. The ₹2,500 is isolated under oneOffExpensesPaise
      expect(forecast.oneOffExpensesPaise).toBe(250000);

      // 3. Living velocity stays anchored to the regular ~₹130-₹150 living pace, NOT ₹800+/day!
      expect(forecast.recentDailySpendPaise).toBe(13050);

      // 4. Remaining days = Oct 10 to Nov 1 = 22 days.
      // Discretionary pool = 4,150 - 500 (reserve) = ₹3,650 (365000 paise).
      // Safe daily spend = floor(3650 / 22) = ₹165/day (16590 paise).
      expect(forecast.safeDailySpendPaise).toBe(Math.floor(365000 / 22));

      // 5. Because living pace (₹150) <= safe spend (₹165), student is still ON TRACK!
      expect(forecast.status).toBe('safe');
      expect(forecast.projectedRunOutDate).toBeNull();
      expect(forecast.statusMessage).toContain('Factoring out ₹2,500 in one-off expenses');
    });

    it('3. Naturally preserves regular weekend lifestyle spending without treating it as an outlier', () => {
      // Oct 1, 2026 was a Thursday.
      // Over 14 days (2 full weeks, Oct 1 to Oct 14):
      // Weekdays: ₹120/day
      // Saturdays & Sundays (Oct 3, 4, 10, 11): ₹350/day
      const today = '2026-10-14';
      const transactions: Transaction[] = [];

      for (let i = 1; i <= 14; i++) {
        const dayStr = String(i).padStart(2, '0');
        const dateISO = `2026-10-${dayStr}`;
        const isWeekendDay = i === 3 || i === 4 || i === 10 || i === 11;
        const amountPaise = isWeekendDay ? 35000 : 12000; // ₹350 on weekend, ₹120 on weekday

        transactions.push({
          id: `tx-${i}`,
          userId: 'user-1',
          type: 'expense',
          amountPaise,
          description: isWeekendDay ? 'Weekend outing' : 'Weekday chai/food',
          transactionDate: dateISO,
          createdAt: `${dateISO}T12:00:00Z`,
        });
      }

      const forecast = calculateForecast({
        todayISO: today,
        cycle: mockCycle,
        transactions,
        recurringExpenses: [],
      });

      // 1. Weekend outings should NOT be discarded as one-off outliers!
      expect(forecast.oneOffExpensesPaise).toBe(0);

      // 2. The 7-day rolling window balances 5 weekdays (₹120) and 2 weekend days (₹350):
      // Weekly total = (5 * 120) + (2 * 350) = 600 + 700 = ₹1,300.
      // Average daily velocity = 1300 / 7 ≈ ₹185.71/day (~18571 paise).
      // Velocity reflects the true recurring weekly lifestyle!
      expect(forecast.recentDailySpendPaise).toBeGreaterThan(18000);
      expect(forecast.recentDailySpendPaise).toBeLessThan(19000);
    });

    it('4. Handles cold start with an early large spend without division errors or crash', () => {
      const today = '2026-10-01'; // Day 1 of cycle
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          userId: 'user-1',
          type: 'expense',
          amountPaise: 300000, // ₹3,000 on Day 1
          description: 'Course Fees',
          transactionDate: '2026-10-01',
          createdAt: '2026-10-01T10:00:00Z',
          isOneOff: true,
        },
      ];

      const forecast = calculateForecast({
        todayISO: today,
        cycle: mockCycle,
        transactions,
        recurringExpenses: [],
      });

      // Balance = 8,000 - 3,000 = ₹5,000
      expect(forecast.currentBalancePaise).toBe(500000);
      expect(forecast.isDataSufficient).toBe(false);
      // Days remaining = 31 days. Discretionary pool = 5,000 - 500 = ₹4,500.
      // Safe daily spend = 450000 / 31 = 14516 paise (~₹145/day)
      expect(forecast.safeDailySpendPaise).toBe(Math.floor(450000 / 31));
      // Uses safe daily spend as fallback velocity
      expect(forecast.recentDailySpendPaise).toBe(forecast.safeDailySpendPaise);
    });

    it('5. Immediately recalculates balance and forecast when a historical transaction is edited', () => {
      const today = '2026-10-10';
      const initialTransactions: Transaction[] = [
        {
          id: 'tx-original',
          userId: 'user-1',
          type: 'expense',
          amountPaise: 250000, // ₹2,500
          description: 'Textbook',
          transactionDate: '2026-10-05',
          createdAt: '2026-10-05T12:00:00Z',
        },
      ];

      // Initial forecast
      const forecastBefore = calculateForecast({
        todayISO: today,
        cycle: mockCycle,
        transactions: initialTransactions,
        recurringExpenses: [],
      });
      expect(forecastBefore.currentBalancePaise).toBe(550000); // 8,000 - 2,500 = ₹5,500

      // Student edits/corrects the transaction: "Actually it was ₹1,800, not ₹2,500"
      const correctedTransactions: Transaction[] = [
        ...initialTransactions,
        {
          id: 'tx-correction',
          userId: 'user-1',
          type: 'expense',
          amountPaise: 180000, // ₹1,800
          description: 'Textbook (discounted)',
          transactionDate: '2026-10-05',
          createdAt: '2026-10-05T14:00:00Z',
          isCorrection: true,
          correctedFromId: 'tx-original',
        },
      ];

      const forecastAfter = calculateForecast({
        todayISO: today,
        cycle: mockCycle,
        transactions: correctedTransactions,
        recurringExpenses: [],
      });

      // Balance immediately updates to: 8,000 - 1,800 = ₹6,200 (+₹700 restored)
      expect(forecastAfter.currentBalancePaise).toBe(620000);
      // Discretionary pool immediately increases by ₹700 (70000 paise)
      expect(forecastAfter.discretionaryPoolPaise - forecastBefore.discretionaryPoolPaise).toBe(70000);
      // Safe daily spend increases accordingly
      expect(forecastAfter.safeDailySpendPaise).toBeGreaterThan(forecastBefore.safeDailySpendPaise);
    });

    it('6. Auto-detects an unlabelled ₹1,800 capital purchase in student persona, preventing velocity inflation', () => {
      const today = '2026-10-15';
      const cycle: AllowanceCycle = {
        id: 'cycle-oct-2026',
        userId: 'aryan-123',
        allowanceAmountPaise: 800000, // ₹8,000
        cycleDayOfMonth: 1,
        currentCycleStart: '2026-10-01',
        nextPayoutDate: '2026-11-01',
        openingBalancePaise: 800000,
        targetReservePaise: 50000, // ₹500
        isActive: true,
      };

      // Standard recurring commitments
      const recurring: RecurringExpense[] = [
        {
          id: 'rec-rent',
          userId: 'aryan-123',
          name: 'Room Rent',
          amountPaise: 250000,
          frequency: 'monthly',
          dueDayOfMonth: 5,
          nextDueDate: '2026-11-05',
          isPaused: false,
          lastPaidDate: '2026-10-05',
        },
        {
          id: 'rec-wifi',
          userId: 'aryan-123',
          name: 'Hostel Wi-Fi',
          amountPaise: 49900,
          frequency: 'monthly',
          dueDayOfMonth: 10,
          nextDueDate: '2026-11-10',
          isPaused: false,
          lastPaidDate: '2026-10-10',
        },
        {
          id: 'rec-recharge',
          userId: 'aryan-123',
          name: 'Mobile Recharge',
          amountPaise: 29900,
          frequency: 'monthly',
          dueDayOfMonth: 20,
          nextDueDate: '2026-10-20',
          isPaused: false,
          lastPaidDate: null,
        },
      ];

      // Normal daily student transactions (auto, lunch, stationery, chai ~₹120-250)
      const baseTransactions: Transaction[] = [
        { id: 'tx-1', userId: 'aryan-123', type: 'expense', amountPaise: 250000, description: 'Room Rent', transactionDate: '2026-10-05', createdAt: '2026-10-05T10:00:00Z', recurringExpenseId: 'rec-rent' },
        { id: 'tx-2', userId: 'aryan-123', type: 'expense', amountPaise: 49900, description: 'Hostel Wi-Fi', transactionDate: '2026-10-10', createdAt: '2026-10-10T11:00:00Z', recurringExpenseId: 'rec-wifi' },
        { id: 'tx-3', userId: 'aryan-123', type: 'expense', amountPaise: 12000, description: 'Auto to North Campus', transactionDate: '2026-10-12', createdAt: '2026-10-12T09:30:00Z' },
        { id: 'tx-4', userId: 'aryan-123', type: 'expense', amountPaise: 18000, description: 'Lunch at College Canteen', transactionDate: '2026-10-13', createdAt: '2026-10-13T13:15:00Z' },
        { id: 'tx-5', userId: 'aryan-123', type: 'expense', amountPaise: 25000, description: 'Photocopying & Notes', transactionDate: '2026-10-14', createdAt: '2026-10-14T15:45:00Z' },
        { id: 'tx-6', userId: 'aryan-123', type: 'expense', amountPaise: 25000, description: 'Chai & Snacks', transactionDate: '2026-10-14', createdAt: '2026-10-14T18:00:00Z' },
      ];

      const forecastBefore = calculateForecast({
        todayISO: today,
        cycle,
        transactions: baseTransactions,
        recurringExpenses: recurring,
      });

      // Daily velocity before the large purchase is around ~₹96/day (9571 paise)
      expect(forecastBefore.recentDailySpendPaise).toBeLessThan(11000);

      // Student logs a ₹1,800 transaction WITHOUT marking isOneOff: true
      const transactionsWithUnlabelledBigSpend: Transaction[] = [
        ...baseTransactions,
        {
          id: 'tx-7',
          userId: 'aryan-123',
          type: 'expense',
          amountPaise: 180000, // ₹1,800 (shopping, shoes, or emergency repair)
          description: 'Winter Jacket & Shoes',
          transactionDate: '2026-10-15',
          createdAt: '2026-10-15T16:00:00Z',
          // isOneOff is deliberately omitted / false!
        },
      ];

      const forecastAfter = calculateForecast({
        todayISO: today,
        cycle,
        transactions: transactionsWithUnlabelledBigSpend,
        recurringExpenses: recurring,
      });

      // 1. Balance correctly reflects the actual money spent:
      // ₹4,201 - ₹1,800 = ₹2,401 (240100 paise)
      expect(forecastAfter.currentBalancePaise).toBe(240100);

      // 2. The calculator automatically identifies the ₹1,800 transaction as an isolated capital one-off:
      expect(forecastAfter.oneOffExpensesPaise).toBe(180000);

      // 3. CRITICAL: The projected daily living velocity did NOT spike to ₹136/day!
      // It stays anchored around ~₹96/day based on normal daily living meals and transport.
      expect(forecastAfter.recentDailySpendPaise).toBeLessThan(11000);
      expect(forecastAfter.recentDailySpendPaise).toBeCloseTo(forecastBefore.recentDailySpendPaise, -2);
    });
  });
});
