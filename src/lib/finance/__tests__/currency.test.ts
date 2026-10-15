import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  formatPaiseToINR,
  parseCurrencyInput,
} from '../currency';

describe('Currency Utility Functions', () => {
  describe('rupeesToPaise & paiseToRupees', () => {
    it('converts whole rupee amounts accurately to paise', () => {
      expect(rupeesToPaise(500)).toBe(50000);
      expect(rupeesToPaise(8000)).toBe(800000);
      expect(rupeesToPaise(0)).toBe(0);
    });

    it('converts fractional amounts without floating-point precision loss', () => {
      // In normal JS: 0.1 + 0.2 = 0.30000000000000004
      expect(rupeesToPaise(120.50)).toBe(12050);
      expect(rupeesToPaise(99.99)).toBe(9999);
      expect(rupeesToPaise(0.20)).toBe(20);
    });

    it('converts paise accurately back to rupees', () => {
      expect(paiseToRupees(12050)).toBe(120.50);
      expect(paiseToRupees(50000)).toBe(500);
      expect(paiseToRupees(99)).toBe(0.99);
    });
  });

  describe('formatPaiseToINR', () => {
    it('formats round rupee amounts with Indian Rupee symbol', () => {
      expect(formatPaiseToINR(800000)).toBe('₹8,000');
      expect(formatPaiseToINR(50000)).toBe('₹500');
    });

    it('formats decimal paise when present', () => {
      expect(formatPaiseToINR(15050)).toBe('₹150.50');
      expect(formatPaiseToINR(9999)).toBe('₹99.99');
    });

    it('supports formatting without symbol when requested', () => {
      expect(formatPaiseToINR(800000, { includeSymbol: false })).toBe('8,000');
    });
  });

  describe('parseCurrencyInput', () => {
    it('parses raw numeric strings', () => {
      expect(parseCurrencyInput('500')).toBe(50000);
      expect(parseCurrencyInput('120.50')).toBe(12050);
    });

    it('strips rupee symbols, commas, and currency keywords', () => {
      expect(parseCurrencyInput('₹500')).toBe(50000);
      expect(parseCurrencyInput('₹ 1,500')).toBe(150000);
      expect(parseCurrencyInput('120 rs')).toBe(12000);
      expect(parseCurrencyInput('Rs. 250')).toBe(25000);
      expect(parseCurrencyInput('1000 inr')).toBe(100000);
    });

    it('returns null for invalid inputs', () => {
      expect(parseCurrencyInput('')).toBeNull();
      expect(parseCurrencyInput('abc')).toBeNull();
      expect(parseCurrencyInput('-100')).toBeNull();
    });
  });
});
