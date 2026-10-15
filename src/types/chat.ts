import { Category, Transaction } from './finance';

export type IntentType =
  | 'log_expense'
  | 'log_batch_expenses'
  | 'log_income'
  | 'correct_transaction'
  | 'undo_transaction'
  | 'budget_query'
  | 'unknown';

export interface BaseParsedIntent {
  intent: IntentType;
  confidence: number; // 0.0 to 1.0
  rawInput: string;
}

export interface ParsedExpenseIntent extends BaseParsedIntent {
  intent: 'log_expense';
  amountPaise: number;
  description: string;
  categoryGuess?: string; // e.g. 'cat-food'
  isOneOff?: boolean;
}

export interface ParsedBatchExpenseIntent extends BaseParsedIntent {
  intent: 'log_batch_expenses';
  expenses: Array<{
    amountPaise: number;
    description: string;
    categoryGuess?: string;
    isOneOff?: boolean;
  }>;
  totalAmountPaise: number;
}

export interface ParsedIncomeIntent extends BaseParsedIntent {
  intent: 'log_income';
  amountPaise: number;
  description: string;
  isRefund?: boolean;
}

export interface ParsedCorrectionIntent extends BaseParsedIntent {
  intent: 'correct_transaction';
  target: 'last' | string;
  targetTransactionId?: string;
  targetKeyword?: string;
  newAmountPaise?: number;
  newDescription?: string;
}

export interface ParsedUndoIntent extends BaseParsedIntent {
  intent: 'undo_transaction';
  target: 'last' | string;
}

export interface ParsedQueryIntent extends BaseParsedIntent {
  intent: 'budget_query';
  queryType: 'safe_spend' | 'will_money_last' | 'affordability_check' | 'general';
  targetAmountPaise?: number;
}

export interface ParsedUnknownIntent extends BaseParsedIntent {
  intent: 'unknown';
}

export type ParsedFinancialIntent =
  | ParsedExpenseIntent
  | ParsedBatchExpenseIntent
  | ParsedIncomeIntent
  | ParsedCorrectionIntent
  | ParsedUndoIntent
  | ParsedQueryIntent
  | ParsedUnknownIntent;

export type ActionStatus = 'pending' | 'confirmed' | 'cancelled';

export interface ProposedTransactionPayload {
  type: 'expense' | 'income';
  amountPaise: number;
  description: string;
  categoryId: string;
  isOneOff?: boolean;
  transactionDate: string;
  isRefund?: boolean;
}

export interface ProposedBatchTransactionsPayload {
  transactions: ProposedTransactionPayload[];
  totalAmountPaise: number;
}

export interface ProposedUpdatePayload {
  targetTransactionId: string;
  originalAmountPaise: number;
  newAmountPaise?: number;
  originalDescription: string;
  newDescription?: string;
  newCategoryId?: string;
  newIsOneOff?: boolean;
}

export interface ProposedDeletePayload {
  targetTransactionId: string;
  description: string;
  amountPaise: number;
}

export interface ProposedQueryPayload {
  queryType: 'safe_spend' | 'will_money_last' | 'affordability_check' | 'general';
  targetAmountPaise?: number;
  directAnswer: string;
}

export type ActionProposal =
  | { id: string; type: 'create_transaction'; status: ActionStatus; payload: ProposedTransactionPayload }
  | { id: string; type: 'create_batch_transactions'; status: ActionStatus; payload: ProposedBatchTransactionsPayload }
  | { id: string; type: 'update_transaction'; status: ActionStatus; payload: ProposedUpdatePayload }
  | { id: string; type: 'delete_transaction'; status: ActionStatus; payload: ProposedDeletePayload }
  | { id: string; type: 'answer_query'; status: ActionStatus; payload: ProposedQueryPayload };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string; // ISO 8601
  actionProposal?: ActionProposal;
  providerUsed?: 'groq' | 'gemini' | 'fallback';
  modelName?: string;
  debugNote?: string;
}
