import { AllowanceCycle, ForecastResult, RecurringExpense, Transaction } from '@/types/finance';
import { ContextualAlert } from '@/types/alerts';
import { getDaysDifference } from './dates';
import { formatRupees } from './currency';

export interface EvaluateAlertsParams {
  todayISO: string;
  cycle: AllowanceCycle;
  forecast: ForecastResult;
  recurringExpenses: RecurringExpense[];
  transactions: Transaction[];
}

/**
 * Deterministically evaluates actionable contextual alerts for the student.
 * Rules operate on verifiable financial math without AI hallucinations.
 */
export function evaluateContextualAlerts(params: EvaluateAlertsParams): ContextualAlert[] {
  const { todayISO, cycle, forecast, recurringExpenses } = params;
  const alerts: ContextualAlert[] = [];

  // 1. Deficit Run-Out Alert (High Priority Danger)
  if (forecast.status === 'danger' && forecast.projectedRunOutDate) {
    alerts.push({
      id: 'alert-deficit-runout',
      category: 'deficit_runout',
      severity: 'danger',
      title: `Projected Shortfall on ${forecast.projectedRunOutDate}`,
      message: `At your current burn rate (~${formatRupees(forecast.recentDailySpendPaise)}/day), your funds will deplete before your next payout on ${cycle.nextPayoutDate}. Limit spending strictly to essentials.`,
      actionLabel: 'Ask AI for Help',
      actionType: 'open_chat',
      metadata: {
        daysRemaining: forecast.daysRemaining,
      },
    });
  }

  // 2. Approaching Bill Due Alerts (<= 5 days)
  for (const bill of recurringExpenses) {
    if (bill.isPaused) continue;

    // Check if bill was already paid in current cycle
    const isPaidThisCycle = Boolean(bill.lastPaidDate && bill.lastPaidDate >= cycle.currentCycleStart);
    if (isPaidThisCycle) continue;

    const daysUntilDue = getDaysDifference(todayISO, bill.nextDueDate);

    // Alert if due within 5 days (including today)
    if (daysUntilDue >= 0 && daysUntilDue <= 5) {
      const dueText = daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : `in ${daysUntilDue} days`;
      alerts.push({
        id: `alert-bill-${bill.id}`,
        category: 'bill_due',
        severity: daysUntilDue <= 1 ? 'warning' : 'info',
        title: `${bill.name} Due ${dueText}`,
        message: `${formatRupees(bill.amountPaise)} is due on ${bill.nextDueDate}. This amount is protected from your daily spending limit.`,
        actionLabel: 'Mark Paid',
        actionType: 'view_bills',
        metadata: {
          billId: bill.id,
          amountPaise: bill.amountPaise,
          dueDate: bill.nextDueDate,
          daysRemaining: daysUntilDue,
        },
      });
    }
  }

  // 3. Burn Rate Pace Warning (Spending > 25% faster than safe pace)
  if (
    forecast.isDataSufficient &&
    forecast.safeDailySpendPaise > 0 &&
    forecast.recentDailySpendPaise > 1.25 * forecast.safeDailySpendPaise
  ) {
    const percentFaster = Math.round(
      ((forecast.recentDailySpendPaise - forecast.safeDailySpendPaise) / forecast.safeDailySpendPaise) * 100
    );

    alerts.push({
      id: 'alert-burn-rate-pace',
      category: 'burn_rate',
      severity: 'warning',
      title: `Spending ${percentFaster}% Faster than Safe Limit`,
      message: `You're burning ~${formatRupees(forecast.recentDailySpendPaise)}/day against a safe limit of ${formatRupees(forecast.safeDailySpendPaise)}/day. Pacing yourself will protect your month-end balance.`,
      actionLabel: 'Check Budget',
      actionType: 'open_chat',
    });
  }

  // 4. Reserve Cushion Breach Warning
  if (forecast.status === 'tight' && forecast.projectedEndBalancePaise < cycle.targetReservePaise && !alerts.some(a => a.category === 'burn_rate')) {
    alerts.push({
      id: 'alert-reserve-breach',
      category: 'reserve_breach',
      severity: 'warning',
      title: 'Safety Reserve at Risk',
      message: `Your projected closing balance (${formatRupees(forecast.projectedEndBalancePaise)}) will dip into your ${formatRupees(cycle.targetReservePaise)} safety cushion. Keeping daily spend at ${formatRupees(forecast.safeDailySpendPaise)}/day preserves your reserve.`,
      actionLabel: 'Simulate Savings',
      actionType: 'adjust_budget',
    });
  }

  // 5. Safe Pace Milestone (If on track and no warnings active)
  if (forecast.status === 'safe' && forecast.daysRemaining > 0 && alerts.length === 0) {
    alerts.push({
      id: 'alert-safe-pace',
      category: 'safe_pace',
      severity: 'success',
      title: 'On Track for Payout Day',
      message: `Your spending velocity is comfortably within your ${formatRupees(forecast.safeDailySpendPaise)}/day limit. You're set to finish the month with your reserve intact.`,
    });
  }

  return alerts;
}
