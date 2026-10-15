import { AiParseResult, AiProvider, AiProviderContext } from '../types';
import { FallbackProvider } from './fallbackProvider';
import { formatRupees } from '@/lib/finance/currency';
import { DEFAULT_CATEGORIES } from '@/lib/store/sampleData';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export class GroqProvider implements AiProvider {
  name = 'groq';
  private apiKey: string;
  private model: string;
  private fallbackProvider: FallbackProvider;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
    this.model = model || process.env.GROQ_MODEL || DEFAULT_MODEL;
    this.fallbackProvider = new FallbackProvider();
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async parseMessage(message: string, context: AiProviderContext): Promise<AiParseResult> {
    // If no API key configured, seamlessly fall back to offline parser
    if (!this.isAvailable()) {
      return this.fallbackProvider.parseMessage(message, context);
    }

    try {
      const categories = context.categories || DEFAULT_CATEGORIES;
      const forecast = context.forecast;
      const recentTx = context.recentTransactions || [];

      const systemPrompt = `You are "Money Survival AI", an intelligent conversational financial companion for Indian college students living on a monthly allowance.
Your job is to extract the user's financial intent from their message and craft a concise, empathetic 1-2 sentence response.

### Available Categories:
${categories.map(c => `- ${c.id}: "${c.name}"`).join('\n')}

### User's Current Financial Context:
- Current Verified Balance: ${forecast ? formatRupees(forecast.currentBalancePaise) : 'Unknown'}
- Days Remaining until Payout: ${forecast ? `${forecast.daysRemaining} days` : 'Unknown'}
- Next Allowance Date: ${context.cycle?.nextPayoutDate || 'Unknown'}
- Discretionary Pool: ${forecast ? formatRupees(forecast.discretionaryPoolPaise) : 'Unknown'}
- Safe Daily Spending Limit: ${forecast ? `${formatRupees(forecast.safeDailySpendPaise)}/day` : 'Unknown'}
- Recent Daily Velocity: ${forecast ? `${formatRupees(forecast.recentDailySpendPaise)}/day` : 'Unknown'}
- Survival Status: ${forecast?.status || 'Unknown'}
- Recent Transactions: ${recentTx.slice(-3).map(t => `${t.description} (${formatRupees(t.amountPaise)})`).join(', ') || 'None'}

### Intent Types to Detect:
1. "log_expense": User spent money (e.g., "spent 120 on auto", "canteen lunch 180", "bought shoes for 1800").
   - amountPaise: Amount in paise (₹1 = 100 paise). ₹180 = 18000 paise.
   - description: Cleaned title (e.g. "Auto to campus", "Canteen Lunch").
   - categoryGuess: Most fitting category id from the list above.
   - isOneOff: true if it is an irregular capital purchase (shoes, jacket, textbook, phone repair, or >= ₹1,000).
2. "log_income": User received money or cashback/refund (e.g., "got 500 cashback", "received 8000 allowance").
   - amountPaise: Amount in paise.
   - isRefund: true for cashbacks/refunds.
3. "correct_transaction": User wants to correct a previous mistake (e.g., "actually lunch was 150 not 180").
   - target: "last"
   - newAmountPaise: New amount in paise.
4. "undo_transaction": User wants to cancel or delete (e.g., "undo", "delete that").
   - target: "last"
5. "budget_query": User asks if they can afford something, how much they can spend today, or if their money will last.
   - queryType: "safe_spend" | "will_money_last" | "affordability_check" | "general"
   - targetAmountPaise: Amount in paise if checking affordability of an item.
6. "unknown": Casual chatter or unrecognized message.

### Output Requirements:
You MUST output ONLY a valid JSON object with the following structure:
{
  "intent": {
    "intent": "log_expense" | "log_income" | "correct_transaction" | "undo_transaction" | "budget_query" | "unknown",
    "amountPaise": 18000,
    "description": "Lunch at canteen",
    "categoryGuess": "cat-food",
    "isOneOff": false,
    "isRefund": false,
    "target": "last",
    "newAmountPaise": 15000,
    "queryType": "safe_spend",
    "targetAmountPaise": 0
  },
  "conversationalReply": "Concise 1-2 sentence response. If logging, say what was drafted. If affordability check, explain the impact on their daily limit truthfully using real numbers."
}`;

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        console.warn(`[GroqProvider] API returned status ${response.status}: ${response.statusText}. Falling back to offline parser.`);
        return this.fallbackProvider.parseMessage(message, context);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return this.fallbackProvider.parseMessage(message, context);
      }

      const parsed = JSON.parse(content);
      if (!parsed.intent || !parsed.intent.intent) {
        return this.fallbackProvider.parseMessage(message, context);
      }

      return {
        intent: {
          ...parsed.intent,
          confidence: 0.95,
          rawInput: message,
        },
        conversationalReply: parsed.conversationalReply || 'Got it.',
        providerUsed: 'groq',
      };
    } catch (err) {
      console.warn('[GroqProvider] Error during inference, gracefully degrading to offline parser:', err);
      return this.fallbackProvider.parseMessage(message, context);
    }
  }
}
