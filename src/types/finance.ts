/**
 * AI Money Tracker — Core Financial Domain Types
 * 
 * Educational Note:
 * All monetary values are represented as integers in minor units ("paise"),
 * where 1 Rupee = 100 paise.
 * For example: ₹500.00 is stored as 50000.
 * This completely prevents floating-point rounding errors (e.g. 0.1 + 0.2 = 0.30000000000000004).
 */

export type TransactionType = 'expense' | 'income' | 'refund';

export type SurvivalStatus = 'safe' | 'tight' | 'danger';

export interface Category {
  id: string;
  userId?: string | null;
  name: string;
  icon: string;
  colorHex: string;
  isSystem: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId?: string | null;
  type: TransactionType;
  /** Amount in paise (always a positive integer, e.g. ₹150.50 -> 15050) */
  amountPaise: number;
  description: string;
  /** ISO Date format YYYY-MM-DD */
  transactionDate: string;
  /** ISO 8601 Timestamp */
  createdAt: string;
  /** Original conversational user input if logged via chat */
  rawInput?: string;
  /** Indicates if this transaction was edited or created as a correction */
  isCorrection?: boolean;
  /** Pointer to original transaction if this is a correction */
  correctedFromId?: string | null;
  /** Pointer to scheduled recurring expense if this transaction represents a recurring bill payment */
  recurringExpenseId?: string | null;
}

export interface AllowanceCycle {
  id: string;
  userId: string;
  /** Allowance amount for the cycle in paise, e.g. ₹8,000 -> 800000 */
  allowanceAmountPaise: number;
  /** Day of the month the payout occurs (1-31) */
  cycleDayOfMonth: number;
  /** ISO Date YYYY-MM-DD of current cycle start */
  currentCycleStart: string;
  /** ISO Date YYYY-MM-DD of next expected allowance payout */
  nextPayoutDate: string;
  /** Opening balance recorded at the start of this cycle in paise */
  openingBalancePaise: number;
  /** Minimum reserve threshold to keep in pocket/bank in paise (e.g. ₹500 -> 50000) */
  targetReservePaise: number;
  isActive: boolean;
}

export interface RecurringExpense {
  id: string;
  userId: string;
  categoryId?: string | null;
  name: string;
  /** Amount in paise */
  amountPaise: number;
  frequency: 'monthly' | 'weekly';
  /** Day of month due (1-31) */
  dueDayOfMonth: number;
  /** ISO Date YYYY-MM-DD of next due date */
  nextDueDate: string;
  isPaused: boolean;
  /** ISO Date YYYY-MM-DD when this bill was last marked paid in current cycle */
  lastPaidDate?: string | null;
}

export interface DailyProjection {
  /** ISO Date YYYY-MM-DD */
  date: string;
  /** Day number relative to today (0 = today, 1 = tomorrow, etc.) */
  dayIndex: number;
  /** Projected opening balance for this simulated day in paise */
  projectedBalancePaise: number;
  /** Recurring scheduled bills falling on this specific day in paise */
  scheduledBillsPaise: number;
  /** Estimated variable discretionary spend for this day in paise */
  estimatedDailySpendPaise: number;
  /** Projected closing balance at the end of this day in paise */
  projectedClosingPaise: number;
  /** Indicates if balance breaches the target reserve on this day */
  isBelowReserve: boolean;
  /** Indicates if balance runs out completely (<= 0) on this day */
  isDeficit: boolean;
}

export interface ForecastResult {
  /** Current ledger balance in paise */
  currentBalancePaise: number;
  /** Number of days remaining until next allowance payout */
  daysRemaining: number;
  /** Total days in this allowance cycle */
  cycleTotalDays: number;
  /** Recommended safe daily spending limit in paise */
  safeDailySpendPaise: number;
  /** Projected balance on the next payout date in paise */
  projectedEndBalancePaise: number;
  /** Projected date when balance hits zero or negative, or null if on track */
  projectedRunOutDate: string | null;
  /** Overall survival status: safe, tight, or danger */
  status: SurvivalStatus;
  /** High-level headline for the user */
  statusHeadline: string;
  /** Clear, non-judgmental natural language explanation */
  statusMessage: string;
  /** Total sum of unpaid recurring bills due between today and next payout in paise */
  committedBillsPaise: number;
  /** Discretionary pool: (currentBalance - committedBills - reserve) in paise */
  discretionaryPoolPaise: number;
  /** User's recent daily burn rate in paise */
  recentDailySpendPaise: number;
  /** Whether there is enough historical data (at least 3 days) for weighted velocity */
  isDataSufficient: boolean;
  /** Detailed day-by-day cashflow simulation */
  simulationTimeline: DailyProjection[];
}

export interface UserProfile {
  id: string;
  displayName: string;
  currencyCode: string;
  currencySymbol: string;
  targetReservePaise: number;
  createdAt: string;
  updatedAt: string;
}
