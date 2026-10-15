export type AlertSeverity = 'info' | 'warning' | 'danger' | 'success';

export type AlertCategory =
  | 'bill_due'
  | 'burn_rate'
  | 'reserve_breach'
  | 'deficit_runout'
  | 'safe_pace';

export interface ContextualAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionType?: 'view_bills' | 'open_chat' | 'adjust_budget';
  metadata?: {
    billId?: string;
    amountPaise?: number;
    dueDate?: string;
    daysRemaining?: number;
  };
}

export interface CategorySpendSummary {
  categoryId: string;
  categoryName: string;
  categoryColorHex: string;
  categoryIcon: string;
  totalSpentPaise: number;
  percentageOfTotal: number; // 0.0 to 100.0
  transactionCount: number;
}

export interface MonthlyAnalyticsSummary {
  totalSpentPaise: number;
  categories: CategorySpendSummary[];
  topCategory?: CategorySpendSummary;
}
