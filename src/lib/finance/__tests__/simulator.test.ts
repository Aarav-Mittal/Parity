import { describe, it, expect } from 'vitest';
import { runSimulation, generateSmartRecommendations } from '../simulator';
import { AllowanceCycle, RecurringExpense, Transaction } from '@/types/finance';
import { ForecastInput } from '../forecast';

describe('Deterministic Financial Simulator', () => {
  const mockCycle: AllowanceCycle = {
    id: 'cycle-1',
    userId: 'user-aryan',
    allowanceAmountPaise: 800000, // ₹8,000
    cycleDayOfMonth: 1,
    currentCycleStart: '2026-10-01',
    nextPayoutDate: '2026-11-01',
    openingBalancePaise: 800000,
    targetReservePaise: 50000, // ₹500
    isActive: true,
  };

  const mockRecurring: RecurringExpense[] = [
    {
      id: 'rec-rent',
      userId: 'user-aryan',
      categoryId: 'cat-housing',
      name: 'Room Rent',
      amountPaise: 250000, // ₹2,500
      frequency: 'monthly',
      dueDayOfMonth: 5,
      nextDueDate: '2026-10-05',
      lastPaidDate: '2026-10-05', // Already paid
      isPaused: false,
    },
    {
      id: 'rec-wifi',
      userId: 'user-aryan',
      categoryId: 'cat-bills',
      name: 'Wi-Fi',
      amountPaise: 49900, // ₹499
      frequency: 'monthly',
      dueDayOfMonth: 10,
      nextDueDate: '2026-10-10',
      lastPaidDate: '2026-10-10', // Already paid
      isPaused: false,
    },
    {
      id: 'rec-mobile',
      userId: 'user-aryan',
      categoryId: 'cat-bills',
      name: 'Mobile Recharge',
      amountPaise: 29900, // ₹299
      frequency: 'monthly',
      dueDayOfMonth: 20,
      nextDueDate: '2026-10-20',
      lastPaidDate: null, // Upcoming
      isPaused: false,
    },
  ];

  // Transactions leading to ₹4,200 balance on Oct 15
  // 8000 - 2500 - 499 - 801 (expenses) = 4200
  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      userId: 'user-aryan',
      categoryId: 'cat-housing',
      type: 'expense',
      amountPaise: 250000,
      description: 'Room Rent Oct',
      transactionDate: '2026-10-05',
      createdAt: '2026-10-05T10:00:00Z',
    },
    {
      id: 'tx-2',
      userId: 'user-aryan',
      categoryId: 'cat-bills',
      type: 'expense',
      amountPaise: 49900,
      description: 'Hostel Wifi',
      transactionDate: '2026-10-10',
      createdAt: '2026-10-10T11:00:00Z',
    },
    {
      id: 'tx-3',
      userId: 'user-aryan',
      categoryId: 'cat-food',
      type: 'expense',
      amountPaise: 80100,
      description: 'Groceries & Canteen',
      transactionDate: '2026-10-14',
      createdAt: '2026-10-14T12:00:00Z',
    },
  ];

  const input: ForecastInput = {
    todayISO: '2026-10-15',
    cycle: mockCycle,
    transactions: mockTransactions,
    recurringExpenses: mockRecurring,
  };

  it('correctly simulates an affordable small purchase', () => {
    // Current safe daily spend is ₹200 (paise 20000)
    // Discretionary: 4200 - 299 - 500 = 3401. 3401 / 17 = ₹200.
    const result = runSimulation(input, {
      oneOffExpensePaise: 50000, // ₹500
    });

    expect(result.currentForecast.safeDailySpendPaise).toBe(20005);
    // After ₹500 purchase, discretionary: 340100 - 50000 = 290100. 290100 / 17 = 17064 paise
    expect(result.simulatedForecast.safeDailySpendPaise).toBe(17064);
    expect(result.safeSpendDeltaPaise).toBe(-2941);
    expect(result.affordabilityVerdict?.isAffordable).toBe(true);
    expect(result.affordabilityVerdict?.status).toBe('safe');
  });

  it('correctly identifies an unaffordable purchase that causes early run-out', () => {
    // Testing ₹4,000 purchase when current balance is ₹4,200 and upcoming bill is ₹299
    // 4200 - 4000 = 200 left -> cannot pay 299 bill on Oct 20 -> runs out!
    const result = runSimulation(input, {
      oneOffExpensePaise: 400000, // ₹4,000
    });

    expect(result.affordabilityVerdict?.isAffordable).toBe(false);
    expect(result.affordabilityVerdict?.status).toBe('danger');
    expect(result.simulatedForecast.status).toBe('danger');
    expect(result.simulatedForecast.projectedRunOutDate).toBeDefined();
  });

  it('simulates cutting daily spend by ₹50/day', () => {
    // Cutting ₹50/day across 17 remaining days should increase projected closing balance by ₹850
    const result = runSimulation(input, {
      dailySpendDeltaPaise: -5000, // -₹50/day
    });

    const expectedGainPaise = 5000 * 17; // ₹850
    expect(result.balanceDeltaPaise).toBe(expectedGainPaise);
    expect(result.simulatedForecast.recentDailySpendPaise).toBe(
      Math.max(0, result.currentForecast.recentDailySpendPaise - 5000)
    );
  });

  it('generates smart recommendations for micro-savings and pace correction', () => {
    const forecast = runSimulation(input).currentForecast;
    const recommendations = generateSmartRecommendations(forecast, mockCycle.targetReservePaise, mockRecurring);

    expect(recommendations.length).toBeGreaterThan(0);
    const chaiRec = recommendations.find(r => r.category === 'micro_savings');
    expect(chaiRec).toBeDefined();
    // 17 days * ₹30/day = ₹510 = 51000 paise
    expect(chaiRec?.impactPaise).toBe(51000);
  });
});
