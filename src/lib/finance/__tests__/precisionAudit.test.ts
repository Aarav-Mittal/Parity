import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaiseToINR,
  formatRupees,
} from '../currency';
import { clampDayToMonth } from '../dates';
import { calculateLedgerBalance, calculateCycleSummary } from '../ledger';
import { Transaction } from '@/types/finance';

describe('Milestone 5.3: Integer Minor Units (Paise) Precision & Boundary Audit', () => {
  it('eliminates IEEE 754 floating point arithmetic inaccuracies', () => {
    // Classic JavaScript float trap: 0.1 + 0.2 !== 0.3
    const floatSum = 0.1 + 0.2;
    expect(floatSum).not.toBe(0.3); // 0.30000000000000004 in raw JS!

    // In our paise integer domain: 10 + 20 === 30
    const paise1 = rupeesToPaise(0.1);
    const paise2 = rupeesToPaise(0.2);
    const sumPaise = paise1 + paise2;

    expect(paise1).toBe(10);
    expect(paise2).toBe(20);
    expect(sumPaise).toBe(30);
    expect(paiseToRupees(sumPaise)).toBe(0.3);
  });

  it('accurately converts fractional rupees to exact integer paise', () => {
    expect(rupeesToPaise(150.5)).toBe(15050);
    expect(rupeesToPaise(0.01)).toBe(1);
    expect(rupeesToPaise(0.99)).toBe(99);
    expect(rupeesToPaise(12.345)).toBe(1235); // Math.round to nearest paise
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('maintains absolute zero-drift over 10,000 iterative transactions', () => {
    // In raw floats, adding 0.1 ten thousand times accumulates rounding drift
    let rawFloatSum = 0;
    let integerPaiseSum = 0;

    const microAmountRupees = 0.1;
    const microAmountPaise = rupeesToPaise(microAmountRupees); // 10 paise

    for (let i = 0; i < 10000; i++) {
      rawFloatSum += microAmountRupees;
      integerPaiseSum += microAmountPaise;
    }

    // Integer paise is mathematically exact
    expect(integerPaiseSum).toBe(100000); // 100,000 paise = ₹1,000.00
    expect(paiseToRupees(integerPaiseSum)).toBe(1000);

    // Float sum drifts
    expect(rawFloatSum).not.toBe(1000);
  });

  it('safely handles large financial numbers without integer overflow', () => {
    // 1 Crore INR (₹10,000,000)
    const oneCroreRupees = 10000000;
    const oneCrorePaise = rupeesToPaise(oneCroreRupees);

    expect(oneCrorePaise).toBe(1000000000); // 1 Billion paise
    expect(Number.isSafeInteger(oneCrorePaise)).toBe(true);
    expect(oneCrorePaise < Number.MAX_SAFE_INTEGER).toBe(true);

    // Format Indian Numbering System
    const formatted = formatPaiseToINR(oneCrorePaise);
    expect(formatted).toBe('₹1,00,00,000');
  });

  it('formats edge cases in currency display consistently', () => {
    expect(formatPaiseToINR(0)).toBe('₹0');
    expect(formatPaiseToINR(5)).toBe('₹0.05');
    expect(formatPaiseToINR(50)).toBe('₹0.50');
    expect(formatPaiseToINR(15000)).toBe('₹150');
    expect(formatPaiseToINR(15050)).toBe('₹150.50');
    expect(formatPaiseToINR(-25000)).toBe('-₹250');
  });

  it('audits ledger calculations against refunds and corrections without NaN or drift', () => {
    const openingBalancePaise = 500000; // ₹5,000
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        userId: 'u1',
        type: 'expense',
        amountPaise: 12050, // ₹120.50
        description: 'Lunch',
        transactionDate: '2026-10-01',
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'tx-2',
        userId: 'u1',
        type: 'refund',
        amountPaise: 2050, // ₹20.50 refund
        description: 'Lunch cash back',
        transactionDate: '2026-10-01',
        createdAt: '2026-10-01T11:00:00Z',
      },
      {
        id: 'tx-3',
        userId: 'u1',
        type: 'expense',
        amountPaise: 3000, // ₹30
        description: 'Chai (original wrong amount)',
        transactionDate: '2026-10-02',
        createdAt: '2026-10-02T12:00:00Z',
      },
      {
        id: 'tx-4',
        userId: 'u1',
        type: 'expense',
        amountPaise: 4000, // ₹40
        description: 'Chai (corrected amount)',
        transactionDate: '2026-10-02',
        createdAt: '2026-10-02T12:05:00Z',
        isCorrection: true,
        correctedFromId: 'tx-3',
      },
    ];

    // Net expenses: 12050 (Lunch) - 2050 (refund) + 4000 (Chai correction supersedes tx-3)
    // = 10000 + 4000 = 14000 paise (₹140)
    // Closing balance: 500000 - 14000 = 486000 paise (₹4,860)
    const balance = calculateLedgerBalance(openingBalancePaise, txs);
    expect(balance).toBe(486000);

    const summary = calculateCycleSummary(openingBalancePaise, txs);
    expect(summary.totalExpensePaise).toBe(16050); // 12050 (tx-1) + 4000 (tx-4, tx-3 superseded)
    expect(summary.totalRefundPaise).toBe(2050); // 2050 (tx-2 refund)
    expect(summary.currentBalancePaise).toBe(486000);
    expect(Number.isNaN(summary.currentBalancePaise)).toBe(false);
  });

  it('correctly clamps calendar dates on February leap years and 30-day months', () => {
    // 31st of April (April only has 30 days) -> Clamps to 30
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);

    // 31st of February in non-leap year (2026) -> Clamps to 28
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);

    // 31st of February in leap year (2024) -> Clamps to 29
    expect(clampDayToMonth(2024, 2, 31)).toBe(29);

    // Normal day inside month
    expect(clampDayToMonth(2026, 10, 15)).toBe(15);
  });
});
