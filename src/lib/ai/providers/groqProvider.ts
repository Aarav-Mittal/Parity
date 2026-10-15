import { AiParseResult, AiProvider, AiProviderContext } from '../types';
import { FallbackProvider } from './fallbackProvider';
import { formatRupees } from '@/lib/finance/currency';
import { DEFAULT_CATEGORIES } from '@/lib/store/sampleData';
import { ParsedBatchExpenseIntent, ParsedExpenseIntent, ParsedFinancialIntent } from '@/types/chat';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const FALLBACK_MODEL = 'qwen/qwen3.8-27b';

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

      const systemPrompt = `You are "Money Survival AI", an intelligent financial companion for Indian college students living on a monthly allowance.
Extract the user's financial intent from their message and craft a concise, friendly 1-2 sentence response.

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

### MULTI-EXPENSE LOGGING (VERY IMPORTANT):
If the user mentions MULTIPLE expenses in a single message (e.g. "spent 20 on a samosa, then 40 on snacks and another 40 for coke" or "auto 50, lunch 120, chai 20"), you MUST extract EVERY SINGLE ITEM into the "transactions" array!
Do NOT lump multiple expenses into one item.

### Output JSON Schema:
You MUST output ONLY a valid JSON object with this exact structure:
{
  "intent": "log_batch_expenses" | "log_expense" | "log_income" | "correct_transaction" | "undo_transaction" | "budget_query" | "unknown",
  "transactions": [
    {
      "type": "expense",
      "amountPaise": 2000,
      "description": "Samosa",
      "categoryGuess": "cat-food",
      "isOneOff": false
    }
  ],
  "income": {
    "amountPaise": 800000,
    "description": "Monthly Allowance",
    "isRefund": false
  },
  "correction": {
    "target": "last",
    "newAmountPaise": 15000,
    "newDescription": "Lunch"
  },
  "query": {
    "queryType": "safe_spend" | "will_money_last" | "affordability_check" | "general",
    "targetAmountPaise": 0
  },
  "conversationalReply": "Concise 1-2 sentence response explaining what was drafted or answering their budget query using real numbers."
}`;

      // Helper function to call Groq API with a specified model
      const callGroq = async (modelToUse: string) => {
        return fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 800,
          }),
        });
      };

      let activeModel = this.model;
      let response = await callGroq(activeModel);

      // If requested model is not found (404), auto-fallback to qwen/qwen3.8-27b
      if (response.status === 404 && activeModel !== FALLBACK_MODEL) {
        console.warn(`[GroqProvider] Model ${activeModel} not found (404). Retrying with ${FALLBACK_MODEL}...`);
        activeModel = FALLBACK_MODEL;
        response = await callGroq(activeModel);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[GroqProvider] API error ${response.status}: ${errorText}. Falling back to offline parser.`);
        const fallbackResult = await this.fallbackProvider.parseMessage(message, context);
        return {
          ...fallbackResult,
          debugNote: `Groq error HTTP ${response.status}: fell back to offline parser`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return this.fallbackProvider.parseMessage(message, context);
      }

      const parsed = JSON.parse(content);
      const reply = parsed.conversationalReply || 'Understood.';

      // Determine final ParsedFinancialIntent based on structured output
      let finalIntent: ParsedFinancialIntent;

      if (parsed.transactions && Array.isArray(parsed.transactions) && parsed.transactions.length > 1) {
        const expenses = parsed.transactions.map((tx: any) => ({
          amountPaise: Number(tx.amountPaise) || 0,
          description: String(tx.description || 'Expense'),
          categoryGuess: String(tx.categoryGuess || 'cat-misc'),
          isOneOff: Boolean(tx.isOneOff),
        }));
        const totalAmountPaise = expenses.reduce((sum: number, e: any) => sum + e.amountPaise, 0);

        finalIntent = {
          intent: 'log_batch_expenses',
          expenses,
          totalAmountPaise,
          confidence: 0.98,
          rawInput: message,
        } as ParsedBatchExpenseIntent;
      } else if (parsed.transactions && Array.isArray(parsed.transactions) && parsed.transactions.length === 1) {
        const tx = parsed.transactions[0];
        finalIntent = {
          intent: 'log_expense',
          amountPaise: Number(tx.amountPaise) || 0,
          description: String(tx.description || 'Expense'),
          categoryGuess: String(tx.categoryGuess || 'cat-misc'),
          isOneOff: Boolean(tx.isOneOff),
          confidence: 0.95,
          rawInput: message,
        } as ParsedExpenseIntent;
      } else if (parsed.intent === 'log_income' || parsed.income) {
        finalIntent = {
          intent: 'log_income',
          amountPaise: Number(parsed.income?.amountPaise || parsed.amountPaise) || 0,
          description: String(parsed.income?.description || 'Income'),
          isRefund: Boolean(parsed.income?.isRefund),
          confidence: 0.95,
          rawInput: message,
        };
      } else if (parsed.intent === 'correct_transaction' || parsed.correction) {
        finalIntent = {
          intent: 'correct_transaction',
          target: 'last',
          newAmountPaise: Number(parsed.correction?.newAmountPaise || parsed.newAmountPaise) || undefined,
          newDescription: parsed.correction?.newDescription || undefined,
          confidence: 0.95,
          rawInput: message,
        };
      } else if (parsed.intent === 'undo_transaction') {
        finalIntent = {
          intent: 'undo_transaction',
          target: 'last',
          confidence: 0.95,
          rawInput: message,
        };
      } else if (parsed.intent === 'budget_query' || parsed.query) {
        finalIntent = {
          intent: 'budget_query',
          queryType: parsed.query?.queryType || 'general',
          targetAmountPaise: Number(parsed.query?.targetAmountPaise) || undefined,
          confidence: 0.95,
          rawInput: message,
        };
      } else {
        finalIntent = {
          intent: 'unknown',
          confidence: 0.5,
          rawInput: message,
        };
      }

      return {
        intent: finalIntent,
        conversationalReply: reply,
        providerUsed: 'groq',
        modelName: activeModel,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[GroqProvider] Error during inference, gracefully degrading to offline parser:', errMsg);
      const fallbackResult = await this.fallbackProvider.parseMessage(message, context);
      return {
        ...fallbackResult,
        debugNote: `Groq exception (${errMsg}): fell back to offline parser`,
      };
    }
  }
}
