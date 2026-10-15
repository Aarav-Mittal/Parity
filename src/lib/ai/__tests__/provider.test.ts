import { describe, it, expect, vi } from 'vitest';
import { FallbackProvider } from '../providers/fallbackProvider';
import { GroqProvider } from '../providers/groqProvider';
import { getAiProvider } from '../index';
import { ARYAN_CYCLE, ARYAN_TRANSACTIONS, DEFAULT_CATEGORIES } from '@/lib/store/sampleData';
import { calculateForecast } from '@/lib/finance/forecast';

describe('AI Provider Adapter Architecture', () => {
  const mockForecast = calculateForecast({
    todayISO: '2026-10-15',
    cycle: ARYAN_CYCLE,
    transactions: ARYAN_TRANSACTIONS,
    recurringExpenses: [],
  });

  const mockContext = {
    cycle: ARYAN_CYCLE,
    forecast: mockForecast,
    recentTransactions: ARYAN_TRANSACTIONS,
    categories: DEFAULT_CATEGORIES,
    todayISO: '2026-10-15',
  };

  describe('FallbackProvider (Offline Deterministic)', () => {
    const provider = new FallbackProvider();

    it('is always available', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('generates clear conversational confirmation for everyday expense', async () => {
      const result = await provider.parseMessage('spent 120 on auto to college', mockContext);
      expect(result.providerUsed).toBe('fallback');
      expect(result.intent.intent).toBe('log_expense');
      expect(result.conversationalReply).toContain('₹120');
      expect(result.conversationalReply).toContain('Travel & Auto');
      expect(result.conversationalReply).toContain('Confirm below');
    });

    it('generates truth-grounded reply for safe daily spend query', async () => {
      const result = await provider.parseMessage('how much can i spend today?', mockContext);
      expect(result.intent.intent).toBe('budget_query');
      expect(result.conversationalReply).toContain('/day');
      expect(result.conversationalReply).toContain('days remaining');
    });

    it('evaluates affordability check accurately using real discretionary pool', async () => {
      // Aryan has discretionary pool of ₹4,200 (since no recurring passed in mock)
      const resultAffordable = await provider.parseMessage('can i buy headphones for 1500?', mockContext);
      expect(resultAffordable.intent.intent).toBe('budget_query');
      expect(resultAffordable.conversationalReply).toContain('Yes, you can afford it');

      // Check an amount that exceeds discretionary pool (e.g. ₹15,000)
      const resultUnaffordable = await provider.parseMessage('can i buy a laptop for 15000?', mockContext);
      expect(resultUnaffordable.conversationalReply).toContain('not recommended');
    });

    it('handles undo intent with target preview', async () => {
      const result = await provider.parseMessage('undo last transaction', mockContext);
      expect(result.intent.intent).toBe('undo_transaction');
      expect(result.conversationalReply).toContain('Confirm below');
    });
  });

  describe('GroqProvider Graceful Degradation', () => {
    it('seamlessly falls back to offline parser when GROQ_API_KEY is not set', async () => {
      const groqWithoutKey = new GroqProvider('', 'llama-3.3-70b-versatile');
      expect(groqWithoutKey.isAvailable()).toBe(false);

      const result = await groqWithoutKey.parseMessage('chai 30', mockContext);
      expect(result.providerUsed).toBe('fallback');
      expect(result.intent.intent).toBe('log_expense');
      if (result.intent.intent === 'log_expense') {
        expect(result.intent.amountPaise).toBe(3000);
      }
    });

    it('gracefully degrades to offline parser if Groq API returns HTTP 429 or network error', async () => {
      const groqWithMockKey = new GroqProvider('gsk_mock_test_key_123');
      expect(groqWithMockKey.isAvailable()).toBe(true);

      // Mock global fetch to simulate HTTP 429 rate limit
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as unknown as Response);

      const result = await groqWithMockKey.parseMessage('spent 250 on lunch', mockContext);
      expect(result.providerUsed).toBe('fallback');
      expect(result.intent.intent).toBe('log_expense');
      if (result.intent.intent === 'log_expense') {
        expect(result.intent.amountPaise).toBe(25000);
      }

      global.fetch = originalFetch;
    });
  });

  describe('Provider Factory getAiProvider()', () => {
    it('returns FallbackProvider by default when no AI credentials are set', () => {
      const active = getAiProvider();
      expect(active.name).toBe('fallback');
      expect(active.isAvailable()).toBe(true);
    });
  });
});
