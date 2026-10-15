import { describe, it, expect } from 'vitest';
import { evaluateContextualAlerts } from '../alerts';
import { calculateCategorySpending } from '../analytics';
import { ARYAN_CYCLE, ARYAN_RECURRING, ARYAN_TRANSACTIONS, DEFAULT_CATEGORIES } from '@/lib/store/sampleData';
import { calculateForecast } from '../forecast';
import { AllowanceCycle, RecurringExpense, Transaction } from '@/types/finance';

describe('Checkpoint 4.1: Contextual Alerts Engine & Category Spending Analytics', () => {
  describe('Contextual Alerts Engine', () => {
    it('1. Flags approaching unpaid bill due in 5 days (Mobile Recharge on Oct 20)', () => {
      const today = '2026-10-15';
      const forecast = calculateForecast({
        todayISO: today,
        cycle: ARYAN_CYCLE,
        transactions: ARYAN_TRANSACTIONS,
        recurringExpenses: ARYAN_RECURRING,
      });

      const alerts = evaluateContextualAlerts({
        todayISO: today,
        cycle: ARYAN_CYCLE,
        forecast,
        recurringExpenses: ARYAN_RECURRING,
        transactions: ARYAN_TRANSACTIONS,
      });

      const billAlert = alerts.find(a => a.category === 'bill_due');
      expect(billAlert).toBeDefined();
      expect(billAlert?.title).toContain('Mobile Recharge Due in 5 days');
      expect(billAlert?.message).toContain('₹299');
      expect(billAlert?.severity).toBe('info');

      // Rent (Oct 5) and Wi-Fi (Oct 10) are already paid and must NOT trigger alerts
      const rentAlert = alerts.find(a => a.id.includes('rec-rent'));
      const wifiAlert = alerts.find(a => a.id.includes('rec-wifi'));
      expect(rentAlert).toBeUndefined();
      expect(wifiAlert).toBeUndefined();
    });

    it('2. Flags high urgency warning when bill is due today or tomorrow', () => {
      const today = '2026-10-19'; // 1 day before mobile recharge
      const forecast = calculateForecast({
        todayISO: today,
        cycle: ARYAN_CYCLE,
        transactions: ARYAN_TRANSACTIONS,
        recurringExpenses: ARYAN_RECURRING,
      });

      const alerts = evaluateContextualAlerts({
        todayISO: today,
        cycle: ARYAN_CYCLE,
        forecast,
        recurringExpenses: ARYAN_RECURRING,
        transactions: ARYAN_TRANSACTIONS,
      });

      const billAlert = alerts.find(a => a.category === 'bill_due');
      expect(billAlert).toBeDefined();
      expect(billAlert?.title).toContain('Mobile Recharge Due Tomorrow');
      expect(billAlert?.severity).toBe('warning');
    });

    it('3. Generates burn rate pace warning when spending > 25% faster than safe target', () => {
      const today = '2026-10-15';
      // User with ₹150 safe limit but burning ₹250/day
      const highBurnCycle: AllowanceCycle = {
        ...ARYAN_CYCLE,
        openingBalancePaise: 350000,
      };

      const highBurnTransactions: Transaction[] = [
        { id: '1', userId: '1', type: 'expense', amountPaise: 45000, description: 'Food', transactionDate: '2026-10-12', createdAt: '2026-10-12T10:00:00Z' },
        { id: '2', userId: '1', type: 'expense', amountPaise: 45000, description: 'Food', transactionDate: '2026-10-13', createdAt: '2026-10-13T10:00:00Z' },
        { id: '3', userId: '1', type: 'expense', amountPaise: 45000, description: 'Food', transactionDate: '2026-10-14', createdAt: '2026-10-14T10:00:00Z' },
        { id: '4', userId: '1', type: 'expense', amountPaise: 45000, description: 'Food', transactionDate: '2026-10-15', createdAt: '2026-10-15T10:00:00Z' },
      ];

      const forecast = calculateForecast({
        todayISO: today,
        cycle: highBurnCycle,
        transactions: highBurnTransactions,
        recurringExpenses: [],
      });

      const alerts = evaluateContextualAlerts({
        todayISO: today,
        cycle: highBurnCycle,
        forecast,
        recurringExpenses: [],
        transactions: highBurnTransactions,
      });

      const paceAlert = alerts.find(a => a.category === 'burn_rate');
      expect(paceAlert).toBeDefined();
      expect(paceAlert?.title).toContain('Faster than Safe Limit');
      expect(paceAlert?.severity).toBe('warning');
    });

    it('4. Generates deficit shortfall alert when student is on course to run out', () => {
      const today = '2026-10-15';
      const lowBalanceCycle: AllowanceCycle = {
        ...ARYAN_CYCLE,
        openingBalancePaise: 200000, // ₹2,000 opening
      };

      // Heavy spending: ₹1,500 already spent, high daily burn rate
      const heavySpendTransactions: Transaction[] = [
        { id: '1', userId: '1', type: 'expense', amountPaise: 50000, description: 'Party', transactionDate: '2026-10-12', createdAt: '2026-10-12T10:00:00Z' },
        { id: '2', userId: '1', type: 'expense', amountPaise: 50000, description: 'Party', transactionDate: '2026-10-13', createdAt: '2026-10-13T10:00:00Z' },
        { id: '3', userId: '1', type: 'expense', amountPaise: 50000, description: 'Party', transactionDate: '2026-10-14', createdAt: '2026-10-14T10:00:00Z' },
      ];

      const forecast = calculateForecast({
        todayISO: today,
        cycle: lowBalanceCycle,
        transactions: heavySpendTransactions,
        recurringExpenses: [],
      });

      const alerts = evaluateContextualAlerts({
        todayISO: today,
        cycle: lowBalanceCycle,
        forecast,
        recurringExpenses: [],
        transactions: heavySpendTransactions,
      });

      const deficitAlert = alerts.find(a => a.category === 'deficit_runout');
      expect(deficitAlert).toBeDefined();
      expect(deficitAlert?.severity).toBe('danger');
      expect(deficitAlert?.title).toContain('Projected Shortfall');
    });
  });

  describe('Category Spending Analytics', () => {
    it('calculates category totals and percentages accurately for Aryan persona', () => {
      const analytics = calculateCategorySpending(ARYAN_TRANSACTIONS, DEFAULT_CATEGORIES, '2026-10-01');

      // Transactions in Aryan's sample data:
      // Room Rent: ₹2,500 (cat-rent)
      // Wi-Fi: ₹499 (cat-wifi)
      // Auto: ₹120 (cat-travel)
      // Lunch: ₹180 (cat-food)
      // Photocopy: ₹250 (cat-shopping)
      // Chai & Snacks: ₹250 (cat-food)
      // Total spent = 2500 + 499 + 120 + 180 + 250 + 250 = ₹3,799 (379900 paise)
      expect(analytics.totalSpentPaise).toBe(379900);

      // Top category is Hostel & Rent (₹2,500 = 65.8%)
      expect(analytics.topCategory?.categoryName).toBe('Hostel & Rent');
      expect(analytics.topCategory?.totalSpentPaise).toBe(250000);
      expect(analytics.topCategory?.percentageOfTotal).toBeCloseTo(65.8, 1);

      // Food & Chai total: 180 + 250 = ₹430 (43000 paise = 11.3%)
      const food = analytics.categories.find(c => c.categoryId === 'cat-food');
      expect(food?.totalSpentPaise).toBe(43000);
      expect(food?.transactionCount).toBe(2);
      expect(food?.percentageOfTotal).toBeCloseTo(11.3, 1);

      // Travel & Auto total: ₹120 (12000 paise = 3.2%)
      const travel = analytics.categories.find(c => c.categoryId === 'cat-travel');
      expect(travel?.totalSpentPaise).toBe(12000);
      expect(travel?.transactionCount).toBe(1);
    });

    it('excludes superseded transactions after a correction', () => {
      const txsWithCorrection: Transaction[] = [
        { id: 'tx-1', userId: '1', type: 'expense', amountPaise: 50000, description: 'Shoes', categoryId: 'cat-shopping', transactionDate: '2026-10-05', createdAt: '2026-10-05T10:00:00Z' },
        { id: 'tx-2', userId: '1', type: 'expense', amountPaise: 30000, description: 'Shoes (discounted)', categoryId: 'cat-shopping', transactionDate: '2026-10-05', createdAt: '2026-10-05T12:00:00Z', isCorrection: true, correctedFromId: 'tx-1' },
      ];

      const analytics = calculateCategorySpending(txsWithCorrection, DEFAULT_CATEGORIES);
      // Superseded tx-1 (₹500) must NOT be counted! Only tx-2 (₹300)
      expect(analytics.totalSpentPaise).toBe(30000);
      expect(analytics.categories[0].totalSpentPaise).toBe(30000);
      expect(analytics.categories[0].transactionCount).toBe(1);
    });
  });
});
