import { AllowanceCycle, Category, ForecastResult, Transaction } from '@/types/finance';
import { ParsedFinancialIntent } from '@/types/chat';

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiProviderContext {
  cycle?: AllowanceCycle;
  forecast?: ForecastResult;
  recentTransactions?: Transaction[];
  categories?: Category[];
  todayISO?: string;
  chatHistory?: ChatHistoryTurn[];
}

export interface AiParseResult {
  intent: ParsedFinancialIntent;
  conversationalReply: string;
  providerUsed: 'groq' | 'gemini' | 'fallback';
  modelName?: string;
  debugNote?: string;
}

export interface AiProvider {
  name: string;
  isAvailable(): boolean;
  parseMessage(message: string, context: AiProviderContext): Promise<AiParseResult>;
}
