import { describe, it, expect } from 'vitest';
import { calculateForecast } from '@/lib/finance/forecast';
import { calculateLedgerBalance } from '@/lib/finance/ledger';
import { evaluateContextualAlerts } from '@/lib/finance/alerts';
import { runSimulation, generateSmartRecommendations } from '@/lib/finance/simulator';
import { FallbackProvider } from '@/lib/ai/providers/fallbackProvider';
import { AllowanceCycle, RecurringExpense, Transaction, Category } from '@/types/finance';

describe('Milestone 5.1: Complete End-to-End User Lifecycle Flow', () => {
  const aiProvider = new FallbackProvider();

  const categories: Category[] = [
    { id: 'cat-food', name: 'Food & Canteen', icon: 'Coffee', colorHex: '#F59E0B', isSystem: true },
    { id: 'cat-transport', name: 'Transit & Auto', icon: 'Bus', colorHex: '#3B82F6', isSystem: true },
    { id: 'cat-housing', name: 'Hostel & Rent', icon: 'Home', colorHex: '#8B5CF6', isSystem: true },
    { id: 'cat-bills', name: 'Bills & Recharge', icon: 'Wifi', colorHex: '#EC4899', isSystem: true },
    { id: 'cat-misc', name: 'Miscellaneous', icon: 'Tag', colorHex: '#64748B', isSystem: true },
  ];

  it('orchestrates complete student semester lifecycle: onboarding -> expenses -> AI chat -> alerts -> simulation -> rollover', async () => {
    // -------------------------------------------------------------
    // PHASE 1: Onboarding on Oct 1
    // -------------------------------------------------------------
    const cycle: AllowanceCycle = {
      id: 'cycle-october-2026',
      userId: 'user-aryan',
      allowanceAmountPaise: 800000, // ₹8,000
      cycleDayOfMonth: 1,
      currentCycleStart: '2026-10-01',
      nextPayoutDate: '2026-11-01',
      openingBalancePaise: 800000,
      targetReservePaise: 50000, // ₹500 safety cushion
      isActive: true,
    };

    let recurringExpenses: RecurringExpense[] = [
      {
        id: 'rec-rent',
        userId: 'user-aryan',
        categoryId: 'cat-housing',
        name: 'Room Rent',
        amountPaise: 250000, // ₹2,500
        frequency: 'monthly',
        dueDayOfMonth: 5,
        nextDueDate: '2026-10-05',
        lastPaidDate: null,
        isPaused: false,
      },
      {
        id: 'rec-wifi',
        userId: 'user-aryan',
        categoryId: 'cat-bills',
        name: 'Hostel Wi-Fi',
        amountPaise: 49900, // ₹499
        frequency: 'monthly',
        dueDayOfMonth: 10,
        nextDueDate: '2026-10-10',
        lastPaidDate: null,
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
        lastPaidDate: null,
        isPaused: false,
      },
    ];

    let transactions: Transaction[] = [];

    // Check Day 1 Forecast (Oct 1)
    let forecast = calculateForecast({
      todayISO: '2026-10-01',
      cycle,
      transactions,
      recurringExpenses,
    });

    expect(forecast.currentBalancePaise).toBe(800000);
    expect(forecast.daysRemaining).toBe(31);
    // Upcoming bills: 2500 + 499 + 299 = ₹3,298 (329800 paise)
    expect(forecast.committedBillsPaise).toBe(329800);
    // Discretionary pool: 800000 - 329800 - 50000 = 420200 paise (₹4,202)
    expect(forecast.discretionaryPoolPaise).toBe(420200);
    // Safe daily spend: floor(420200 / 31) = 13554 paise (~₹135.54)
    expect(forecast.safeDailySpendPaise).toBe(13554);
    expect(forecast.status).toBe('safe');

    // -------------------------------------------------------------
    // PHASE 2: Pay Fixed Bills (Oct 5: Rent, Oct 10: Wi-Fi)
    // -------------------------------------------------------------
    // Oct 5: Pay Room Rent
    transactions.push({
      id: 'tx-rent',
      userId: cycle.userId,
      type: 'expense',
      amountPaise: 250000,
      description: 'Room Rent Oct',
      categoryId: 'cat-housing',
      transactionDate: '2026-10-05',
      createdAt: '2026-10-05T10:00:00Z',
    });
    // Mark recurring bill as paid
    recurringExpenses = recurringExpenses.map(b =>
      b.id === 'rec-rent' ? { ...b, lastPaidDate: '2026-10-05' } : b
    );

    // Oct 10: Pay Wi-Fi
    transactions.push({
      id: 'tx-wifi',
      userId: cycle.userId,
      type: 'expense',
      amountPaise: 49900,
      description: 'Hostel Wifi',
      categoryId: 'cat-bills',
      transactionDate: '2026-10-10',
      createdAt: '2026-10-10T10:00:00Z',
    });
    recurringExpenses = recurringExpenses.map(b =>
      b.id === 'rec-wifi' ? { ...b, lastPaidDate: '2026-10-10' } : b
    );

    // Ledger balance: 800000 - 250000 - 49900 = 500100 paise (₹5,001)
    expect(calculateLedgerBalance(cycle.openingBalancePaise, transactions)).toBe(500100);

    // -------------------------------------------------------------
    // PHASE 3: Conversational AI Expense Logging (Batch)
    // -------------------------------------------------------------
    // Student logs multiple expenses in natural language
    const aiBatchResult = await aiProvider.parseMessage('spent 120 on auto and 30 for chai', {
      cycle,
      recentTransactions: transactions,
      categories,
      todayISO: '2026-10-12',
    });

    expect(aiBatchResult.intent.intent).toBe('log_batch_expenses');
    if (aiBatchResult.intent.intent === 'log_batch_expenses') {
      expect(aiBatchResult.intent.expenses.length).toBe(2);
      expect(aiBatchResult.intent.expenses[0].amountPaise).toBe(12000); // ₹120
      expect(aiBatchResult.intent.expenses[1].amountPaise).toBe(3000); // ₹30

      // Add to ledger
      transactions.push({
        id: 'tx-auto',
        userId: cycle.userId,
        type: 'expense',
        amountPaise: 12000,
        description: 'Auto',
        categoryId: 'cat-transport',
        transactionDate: '2026-10-12',
        createdAt: '2026-10-12T14:00:00Z',
      });
      transactions.push({
        id: 'tx-chai',
        userId: cycle.userId,
        type: 'expense',
        amountPaise: 3000,
        description: 'Chai',
        categoryId: 'cat-food',
        transactionDate: '2026-10-12',
        createdAt: '2026-10-12T14:05:00Z',
      });
    }

    // Balance: 500100 - 15000 = 485100 paise (₹4,851)
    expect(calculateLedgerBalance(cycle.openingBalancePaise, transactions)).toBe(485100);

    // -------------------------------------------------------------
    // PHASE 4: Conversational AI Correction
    // -------------------------------------------------------------
    // Student corrects mistake: "actually chai was 40 not 30"
    const aiCorrectionResult = await aiProvider.parseMessage('actually chai was 40 not 30', {
      cycle,
      recentTransactions: transactions,
      categories,
      todayISO: '2026-10-12',
    });

    expect(aiCorrectionResult.intent.intent).toBe('correct_transaction');
    if (aiCorrectionResult.intent.intent === 'correct_transaction') {
      expect(aiCorrectionResult.intent.newAmountPaise).toBe(4000); // ₹40
      // Update last transaction in ledger
      const lastIndex = transactions.length - 1;
      transactions[lastIndex] = {
        ...transactions[lastIndex],
        amountPaise: 4000,
      };
    }

    // Balance: 485100 - 1000 = 484100 paise (₹4,841)
    expect(calculateLedgerBalance(cycle.openingBalancePaise, transactions)).toBe(484100);

    // -------------------------------------------------------------
    // PHASE 5: Contextual Alerts on Oct 15 (Mid-cycle check)
    // -------------------------------------------------------------
    // Advance time to Oct 15
    forecast = calculateForecast({
      todayISO: '2026-10-15',
      cycle,
      transactions,
      recurringExpenses,
    });

    // Days remaining: Oct 15 to Nov 1 = 17 days
    expect(forecast.daysRemaining).toBe(17);
    // Only Mobile Recharge (₹299) remains upcoming
    expect(forecast.committedBillsPaise).toBe(29900);

    // Evaluate alerts
    const activeAlerts = evaluateContextualAlerts({
      todayISO: '2026-10-15',
      cycle,
      forecast,
      recurringExpenses,
      transactions,
    });

    // Alert 1: Mobile recharge due in 5 days (Oct 20 <= Oct 15 + 5 days)
    const billAlert = activeAlerts.find(a => a.category === 'bill_due');
    expect(billAlert).toBeDefined();
    expect(billAlert?.title).toContain('Mobile Recharge Due in 5 days');
    expect(billAlert?.severity).toBe('info');

    // -------------------------------------------------------------
    // PHASE 6: What-If Simulation
    // -------------------------------------------------------------
    // Test Scenario A: Can Aryan buy a ₹1,800 jacket?
    const simulationAffordable = runSimulation(
      {
        todayISO: '2026-10-15',
        cycle,
        transactions,
        recurringExpenses,
      },
      {
        oneOffExpensePaise: 180000, // ₹1,800
      }
    );

    // Current safe daily spend:
    // Discretionary: 484100 - 29900 - 50000 = 404200 paise. 404200 / 17 = 23776 paise (₹237.76)
    expect(simulationAffordable.currentForecast.safeDailySpendPaise).toBe(23776);
    // After ₹1,800 jacket:
    // Discretionary: 404200 - 180000 = 224200 paise. 224200 / 17 = 13188 paise (₹131.88)
    expect(simulationAffordable.simulatedForecast.safeDailySpendPaise).toBe(13188);
    expect(simulationAffordable.affordabilityVerdict?.isAffordable).toBe(true);
    expect(simulationAffordable.affordabilityVerdict?.status).toBe('safe');

    // Test Scenario B: Can Aryan buy an expensive ₹4,500 gadget?
    const simulationDangerous = runSimulation(
      {
        todayISO: '2026-10-15',
        cycle,
        transactions,
        recurringExpenses,
      },
      {
        oneOffExpensePaise: 450000, // ₹4,500
      }
    );
    expect(simulationDangerous.affordabilityVerdict?.isAffordable).toBe(false);
    expect(simulationDangerous.affordabilityVerdict?.status).toBe('danger');
    expect(simulationDangerous.simulatedForecast.status).toBe('danger');

    // -------------------------------------------------------------
    // PHASE 7: Smart Spending Recommendations
    // -------------------------------------------------------------
    const recommendations = generateSmartRecommendations(
      forecast,
      cycle.targetReservePaise,
      recurringExpenses
    );
    expect(recommendations.length).toBeGreaterThan(0);
    const chaiTip = recommendations.find(r => r.category === 'micro_savings');
    expect(chaiTip).toBeDefined();
    // 17 days * ₹30/day = ₹510 (51000 paise)
    expect(chaiTip?.impactPaise).toBe(51000);

    // -------------------------------------------------------------
    // PHASE 8: Month-End Rollover on Nov 1
    // -------------------------------------------------------------
    const endForecast = calculateForecast({
      todayISO: '2026-11-01',
      cycle,
      transactions,
      recurringExpenses,
    });

    // On payout day, daysRemaining is 0 and engine flags payout day
    expect(endForecast.daysRemaining).toBe(0);
    expect(endForecast.statusHeadline).toBe('Allowance payout day!');
  });
});
