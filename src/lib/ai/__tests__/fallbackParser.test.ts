import { describe, it, expect } from 'vitest';
import {
  extractAmount,
  guessCategory,
  isOneOffCandidate,
  parseNaturalLanguageInput,
} from '../fallbackParser';

describe('Offline Fallback Parser (Zero-Cost Deterministic Intent Extractor)', () => {
  describe('Amount Extraction', () => {
    it('extracts plain numbers, rupee signs, and Rs prefix', () => {
      expect(extractAmount('spent 120 on auto')?.amountPaise).toBe(12000);
      expect(extractAmount('paid ₹250 for biryani')?.amountPaise).toBe(25000);
      expect(extractAmount('paid Rs. 350 for dinner')?.amountPaise).toBe(35000);
      expect(extractAmount('chai 30')?.amountPaise).toBe(3000);
      expect(extractAmount('hostel rent 2500/-')?.amountPaise).toBe(250000);
    });

    it('extracts informal "k" shorthand and "bucks"', () => {
      expect(extractAmount('bought shoes for 2k')?.amountPaise).toBe(200000);
      expect(extractAmount('course fees 2.5k')?.amountPaise).toBe(250000);
      expect(extractAmount('500 bucks on groceries')?.amountPaise).toBe(50000);
    });

    it('handles commas in thousands notation', () => {
      expect(extractAmount('laptop repair 1,800 rs')?.amountPaise).toBe(180000);
    });
  });

  describe('Category Auto-Tagging', () => {
    it('classifies student food and chai keywords to Food & Chai', () => {
      expect(guessCategory('morning chai')).toBe('cat-food');
      expect(guessCategory('canteen thali lunch')).toBe('cat-food');
      expect(guessCategory('swiggy biryani delivery')).toBe('cat-food');
      expect(guessCategory('evening momos and snacks')).toBe('cat-food');
    });

    it('classifies daily transit keywords to Travel & Auto', () => {
      expect(guessCategory('auto to north campus')).toBe('cat-travel');
      expect(guessCategory('metro card recharge')).toBe('cat-travel');
      expect(guessCategory('uber ride home')).toBe('cat-travel');
      expect(guessCategory('bus ticket fare')).toBe('cat-travel');
    });

    it('classifies recurring and academic expenses accurately', () => {
      expect(guessCategory('hostel room rent')).toBe('cat-rent');
      expect(guessCategory('jio mobile recharge')).toBe('cat-wifi');
      expect(guessCategory('hostel wi-fi bill')).toBe('cat-wifi');
      expect(guessCategory('photocopying class notes and stationery')).toBe('cat-shopping');
      expect(guessCategory('bought shoes from myntra')).toBe('cat-shopping');
      expect(guessCategory('paracetamol tablets from pharmacy')).toBe('cat-health');
    });

    it('falls back to Miscellaneous for ambiguous inputs', () => {
      expect(guessCategory('general spending')).toBe('cat-misc');
    });
  });

  describe('One-Off Capital Candidate Detection', () => {
    it('flags amounts >= ₹1,000 as capital candidates', () => {
      expect(isOneOffCandidate('shopping', 180000)).toBe(true); // ₹1,800
      expect(isOneOffCandidate('emergency fee', 100000)).toBe(true); // ₹1,000
    });

    it('flags explicit irregular capital keywords even if below ₹1,000', () => {
      expect(isOneOffCandidate('bought winter jacket', 80000)).toBe(true);
      expect(isOneOffCandidate('dentist visit', 60000)).toBe(true);
    });

    it('does not flag everyday meals and transport as one-offs', () => {
      expect(isOneOffCandidate('canteen lunch', 18000)).toBe(false); // ₹180
      expect(isOneOffCandidate('auto fare', 12000)).toBe(false); // ₹120
      expect(isOneOffCandidate('chai and samosa', 4500)).toBe(false); // ₹45
    });
  });

  describe('End-to-End Intent Parsing', () => {
    it('parses typical student daily expense log', () => {
      const result = parseNaturalLanguageInput('spent 120 on auto to college');
      expect(result.intent).toBe('log_expense');
      if (result.intent === 'log_expense') {
        expect(result.amountPaise).toBe(12000);
        expect(result.categoryGuess).toBe('cat-travel');
        expect(result.isOneOff).toBe(false);
      }
    });

    it('parses unlabelled capital purchase and flags isOneOff', () => {
      const result = parseNaturalLanguageInput('bought shoes for 1800');
      expect(result.intent).toBe('log_expense');
      if (result.intent === 'log_expense') {
        expect(result.amountPaise).toBe(180000);
        expect(result.categoryGuess).toBe('cat-shopping');
        expect(result.isOneOff).toBe(true);
      }
    });

    it('parses ultra-concise inputs (chai 30, auto 120)', () => {
      const result1 = parseNaturalLanguageInput('chai 30');
      expect(result1.intent).toBe('log_expense');
      if (result1.intent === 'log_expense') {
        expect(result1.amountPaise).toBe(3000);
        expect(result1.categoryGuess).toBe('cat-food');
      }

      const result2 = parseNaturalLanguageInput('auto 120');
      expect(result2.intent).toBe('log_expense');
      if (result2.intent === 'log_expense') {
        expect(result2.amountPaise).toBe(12000);
        expect(result2.categoryGuess).toBe('cat-travel');
      }
    });

    it('parses allowance income and cashback refunds', () => {
      const allowance = parseNaturalLanguageInput('received 8000 monthly allowance');
      expect(allowance.intent).toBe('log_income');
      if (allowance.intent === 'log_income') {
        expect(allowance.amountPaise).toBe(800000);
        expect(allowance.isRefund).toBe(false);
      }

      const cashback = parseNaturalLanguageInput('got 500 cashback from gpay');
      expect(cashback.intent).toBe('log_income');
      if (cashback.intent === 'log_income') {
        expect(cashback.amountPaise).toBe(50000);
        expect(cashback.isRefund).toBe(true);
      }
    });

    it('parses correction intent', () => {
      const correction = parseNaturalLanguageInput('actually lunch was 150 not 180');
      expect(correction.intent).toBe('correct_transaction');
      if (correction.intent === 'correct_transaction') {
        expect(correction.newAmountPaise).toBe(15000);
        expect(correction.target).toBe('last');
      }

      const changeTo = parseNaturalLanguageInput('change that to 200');
      expect(changeTo.intent).toBe('correct_transaction');
      if (changeTo.intent === 'correct_transaction') {
        expect(changeTo.newAmountPaise).toBe(20000);
      }
    });

    it('parses undo and deletion requests', () => {
      expect(parseNaturalLanguageInput('undo')?.intent).toBe('undo_transaction');
      expect(parseNaturalLanguageInput('undo that')?.intent).toBe('undo_transaction');
      expect(parseNaturalLanguageInput('delete last transaction')?.intent).toBe('undo_transaction');
    });

    it('parses budget and affordability inquiries', () => {
      const query1 = parseNaturalLanguageInput('how much can i spend today?');
      expect(query1.intent).toBe('budget_query');
      if (query1.intent === 'budget_query') {
        expect(query1.queryType).toBe('safe_spend');
      }

      const query2 = parseNaturalLanguageInput('will my money last?');
      expect(query2.intent).toBe('budget_query');
      if (query2.intent === 'budget_query') {
        expect(query2.queryType).toBe('will_money_last');
      }

      const query3 = parseNaturalLanguageInput('can i buy headphones for 1500?');
      expect(query3.intent).toBe('budget_query');
      if (query3.intent === 'budget_query') {
        expect(query3.queryType).toBe('affordability_check');
        expect(query3.targetAmountPaise).toBe(150000);
      }
    });

    it('parses multiple expenses from a single natural sentence (batch logging)', () => {
      const result = parseNaturalLanguageInput('i spent 20 on a samosa, then 40 on snacks and another 40 for coke');
      expect(result.intent).toBe('log_batch_expenses');
      if (result.intent === 'log_batch_expenses') {
        expect(result.expenses).toHaveLength(3);
        expect(result.expenses[0].amountPaise).toBe(2000);
        expect(result.expenses[0].description).toBe('Samosa');
        expect(result.expenses[0].categoryGuess).toBe('cat-food');

        expect(result.expenses[1].amountPaise).toBe(4000);
        expect(result.expenses[1].description).toBe('Snacks');
        expect(result.expenses[1].categoryGuess).toBe('cat-food');

        expect(result.expenses[2].amountPaise).toBe(4000);
        expect(result.expenses[2].description).toBe('Coke');
        expect(result.expenses[2].categoryGuess).toBe('cat-food');

        expect(result.totalAmountPaise).toBe(10000); // ₹100
      }

      const conciseBatch = parseNaturalLanguageInput('auto 50, lunch 120, chai 20');
      expect(conciseBatch.intent).toBe('log_batch_expenses');
      if (conciseBatch.intent === 'log_batch_expenses') {
        expect(conciseBatch.expenses).toHaveLength(3);
        expect(conciseBatch.totalAmountPaise).toBe(19000); // ₹190
      }
    });

    it('returns unknown intent for unparseable chatter', () => {
      expect(parseNaturalLanguageInput('hey there')?.intent).toBe('unknown');
      expect(parseNaturalLanguageInput('')?.intent).toBe('unknown');
    });
  });
});
