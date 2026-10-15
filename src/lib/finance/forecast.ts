import {
  Transaction,
  RecurringExpense,
  AllowanceCycle,
  ForecastResult,
  DailyProjection,
  SurvivalStatus,
} from '@/types/finance';
import { calculateLedgerBalance, filterTransactionsByDateRange } from './ledger';
import {
  addDaysToDate,
  getDaysDifference,
  parseISODate,
  clampDayToMonth,
} from './dates';
import { formatPaiseToINR } from './currency';

/**
 * AI Money Tracker — Deterministic Money Survival & Forecasting Engine
 * 
 * Core Philosophy:
 * Zero Hallucination. Zero Black-Box ML for basic cashflow math.
 * Pure, deterministic day-by-day cashflow simulation that accounts for:
 * 1. Current real ledger balance.
 * 2. Days remaining until next payout.
 * 3. Scheduled recurring bills due before next payout (without double counting).
 * 4. User's minimum reserve target.
 * 5. Weighted spending velocity (with transparent cold-start handling).
 */

export interface ForecastInput {
  todayISO: string;
  cycle: AllowanceCycle;
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
}

/**
 * Checks if a recurring expense has already been marked as paid in the current cycle.
 */
export function isRecurringExpensePaidInCycle(
  expense: RecurringExpense,
  cycleStartISO: string
): boolean {
  if (!expense.lastPaidDate) return false;
  return expense.lastPaidDate >= cycleStartISO;
}

/**
 * Calculates upcoming unpaid recurring obligations between today and the next payout date.
 */
export function getUpcomingCommittedBills(
  recurringExpenses: RecurringExpense[],
  todayISO: string,
  nextPayoutISO: string,
  cycleStartISO: string
): { totalCommittedPaise: number; billsDueByDate: Map<string, number> } {
  const billsDueByDate = new Map<string, number>();
  let totalCommittedPaise = 0;

  for (const exp of recurringExpenses) {
    if (exp.isPaused) continue;

    // If already marked paid in this active cycle, skip (prevents double counting!)
    if (isRecurringExpensePaidInCycle(exp, cycleStartISO)) {
      continue;
    }

    // Determine the due date in the current calendar window
    const today = parseISODate(todayISO);
    const todayYear = today.getUTCFullYear();
    const todayMonth = today.getUTCMonth() + 1;

    // Check due date in current month
    const clampedDay = clampDayToMonth(todayYear, todayMonth, exp.dueDayOfMonth);
    const dueDateThisMonth = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

    // If due date is between today and next payout, include it
    if (dueDateThisMonth >= todayISO && dueDateThisMonth < nextPayoutISO) {
      totalCommittedPaise += exp.amountPaise;
      const current = billsDueByDate.get(dueDateThisMonth) || 0;
      billsDueByDate.set(dueDateThisMonth, current + exp.amountPaise);
    } else {
      // Check next month if next payout spans into next month
      let nextMonth = todayMonth + 1;
      let nextYear = todayYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      const clampedNext = clampDayToMonth(nextYear, nextMonth, exp.dueDayOfMonth);
      const dueDateNextMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(clampedNext).padStart(2, '0')}`;
      if (dueDateNextMonth >= todayISO && dueDateNextMonth < nextPayoutISO) {
        totalCommittedPaise += exp.amountPaise;
        const current = billsDueByDate.get(dueDateNextMonth) || 0;
        billsDueByDate.set(dueDateNextMonth, current + exp.amountPaise);
      }
    }
  }

  return { totalCommittedPaise, billsDueByDate };
}

/**
 * Computes the user's spending burn rate / velocity.
 * Handles cold start transparently when fewer than 3 days of data exist.
 */
export function calculateSpendingVelocity(
  transactions: Transaction[],
  cycleStartISO: string,
  todayISO: string,
  defaultSafeDailyPaise: number
): { velocityPaise: number; isDataSufficient: boolean } {
  // Filter variable cycle expenses that occurred up to today.
  // We explicitly exclude fixed recurring bill payments (e.g. room rent) so they do not artificially distort daily variable velocity!
  const cycleExpenses = transactions.filter(
    tx => tx.type === 'expense' && 
          tx.transactionDate >= cycleStartISO && 
          tx.transactionDate <= todayISO &&
          !tx.recurringExpenseId
  );

  const daysElapsed = Math.max(1, getDaysDifference(cycleStartISO, todayISO) + 1);

  // If fewer than 3 days have elapsed or fewer than 2 expenses recorded, use conservative safe spend
  if (daysElapsed < 3 || cycleExpenses.length < 2) {
    return {
      velocityPaise: defaultSafeDailyPaise,
      isDataSufficient: false,
    };
  }

  // Calculate full cycle daily average
  const totalCycleExpensePaise = cycleExpenses.reduce((sum, tx) => sum + tx.amountPaise, 0);
  const cycleDailyAverage = totalCycleExpensePaise / daysElapsed;

  // Calculate recent 3-day average
  const threeDaysAgoISO = addDaysToDate(todayISO, -2);
  const recentExpenses = cycleExpenses.filter(tx => tx.transactionDate >= threeDaysAgoISO);
  const recentTotalPaise = recentExpenses.reduce((sum, tx) => sum + tx.amountPaise, 0);
  const recent3DayAverage = recentTotalPaise / 3;

  // Weighted velocity: 70% recent habits + 30% cycle average
  const weightedVelocity = Math.round(0.7 * recent3DayAverage + 0.3 * cycleDailyAverage);

  return {
    velocityPaise: Math.max(0, weightedVelocity),
    isDataSufficient: true,
  };
}

/**
 * The Master Forecasting Function.
 */
export function calculateForecast(input: ForecastInput): ForecastResult {
  const { todayISO, cycle, transactions, recurringExpenses } = input;

  // 1. Calculate current real ledger balance
  const currentBalancePaise = calculateLedgerBalance(cycle.openingBalancePaise, transactions);

  // 2. Compute cycle timelines
  const daysRemaining = Math.max(0, getDaysDifference(todayISO, cycle.nextPayoutDate));
  const cycleTotalDays = Math.max(1, getDaysDifference(cycle.currentCycleStart, cycle.nextPayoutDate));

  // 3. Find committed bills due before next payout
  const { totalCommittedPaise, billsDueByDate } = getUpcomingCommittedBills(
    recurringExpenses,
    todayISO,
    cycle.nextPayoutDate,
    cycle.currentCycleStart
  );

  // 4. Calculate discretionary pool and recommended safe daily spend
  const targetReservePaise = cycle.targetReservePaise || 0;
  const discretionaryPoolPaise = Math.max(0, currentBalancePaise - totalCommittedPaise - targetReservePaise);

  const safeDailySpendPaise = daysRemaining > 0 
    ? Math.floor(discretionaryPoolPaise / daysRemaining) 
    : discretionaryPoolPaise;

  // 5. Calculate spending velocity
  const { velocityPaise: recentDailySpendPaise, isDataSufficient } = calculateSpendingVelocity(
    transactions,
    cycle.currentCycleStart,
    todayISO,
    safeDailySpendPaise
  );

  // 6. Day-by-day cashflow simulation
  const simulationTimeline: DailyProjection[] = [];
  let simulatedBalance = currentBalancePaise;
  let projectedRunOutDate: string | null = null;
  let firstBelowReserveDate: string | null = null;

  for (let d = 0; d < daysRemaining; d++) {
    const simDate = addDaysToDate(todayISO, d);
    const dayBills = billsDueByDate.get(simDate) || 0;
    const daySpend = recentDailySpendPaise;

    const openingForDay = simulatedBalance;
    const closingForDay = openingForDay - dayBills - daySpend;

    const isBelowReserve = closingForDay < targetReservePaise;
    const isDeficit = closingForDay <= 0;

    if (isDeficit && !projectedRunOutDate) {
      projectedRunOutDate = simDate;
    }
    if (isBelowReserve && !firstBelowReserveDate) {
      firstBelowReserveDate = simDate;
    }

    simulationTimeline.push({
      date: simDate,
      dayIndex: d,
      projectedBalancePaise: openingForDay,
      scheduledBillsPaise: dayBills,
      estimatedDailySpendPaise: daySpend,
      projectedClosingPaise: closingForDay,
      isBelowReserve,
      isDeficit,
    });

    simulatedBalance = closingForDay;
  }

  const projectedEndBalancePaise = simulatedBalance;

  // 7. Determine survival status & craft transparent, non-judgmental messaging
  let status: SurvivalStatus = 'safe';
  let statusHeadline = '';
  let statusMessage = '';

  const formattedSafeSpend = formatPaiseToINR(safeDailySpendPaise);
  const formattedVelocity = formatPaiseToINR(recentDailySpendPaise);
  const formattedReserve = formatPaiseToINR(targetReservePaise);
  const formattedEndBalance = formatPaiseToINR(projectedEndBalancePaise);
  const formattedCommitted = formatPaiseToINR(totalCommittedPaise);
  const formattedCurrentBalance = formatPaiseToINR(currentBalancePaise);

  const isPassedCycle = todayISO > cycle.nextPayoutDate;
  const isZeroDays = daysRemaining === 0;

  if (currentBalancePaise <= 0) {
    status = 'danger';
    projectedRunOutDate = todayISO;
    statusHeadline = 'Balance in deficit';
    statusMessage = `Your current balance is ${formattedCurrentBalance}. You have run out of available funds. Any emergency spending should be kept to a minimum until your next allowance.`;
  } else if (isPassedCycle) {
    status = 'safe';
    statusHeadline = 'Cycle completed';
    statusMessage = `Your allowance date of ${cycle.nextPayoutDate} has arrived. Start or confirm your new allowance cycle to continue tracking.`;
  } else if (isZeroDays) {
    status = 'safe';
    statusHeadline = 'Allowance payout day!';
    statusMessage = `Today is your allowance day! You have ${formattedCurrentBalance} remaining from this cycle.`;
  } else if (projectedRunOutDate) {
    status = 'danger';
    const daysUntilRunOut = getDaysDifference(todayISO, projectedRunOutDate);
    const daysShort = daysRemaining - daysUntilRunOut;

    statusHeadline = 'Projected shortfall before next allowance';
    statusMessage = `At your current pace of ${formattedVelocity}/day, your balance may run out around ${projectedRunOutDate} (${daysShort} day${daysShort === 1 ? '' : 's'} before your next allowance). Aim to spend no more than ${formattedSafeSpend}/day to stay afloat.`;
  } else if (projectedEndBalancePaise < targetReservePaise || (isDataSufficient && recentDailySpendPaise > safeDailySpendPaise)) {
    status = 'tight';
    statusHeadline = "You're on track, but your budget is tight";
    statusMessage = `Your current spending of ${formattedVelocity}/day will leave ${formattedEndBalance} by your next payout, dipping into your ${formattedReserve} reserve. Aim for ${formattedSafeSpend}/day to keep your cushion intact.`;
  } else {
    status = 'safe';
    statusHeadline = "You're on track to make it to your next allowance";
    if (isDataSufficient) {
      statusMessage = `Spending around ${formattedVelocity}/day is well within your safe limit of ${formattedSafeSpend}/day. You are projected to finish with ${formattedEndBalance} remaining.`;
    } else {
      statusMessage = `You have ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining until your next allowance. Aim to spend no more than ${formattedSafeSpend}/day${totalCommittedPaise > 0 ? ` after accounting for ${formattedCommitted} in upcoming bills` : ''}.`;
    }
  }

  return {
    currentBalancePaise,
    daysRemaining,
    cycleTotalDays,
    safeDailySpendPaise,
    projectedEndBalancePaise,
    projectedRunOutDate,
    status,
    statusHeadline,
    statusMessage,
    committedBillsPaise: totalCommittedPaise,
    discretionaryPoolPaise,
    recentDailySpendPaise,
    isDataSufficient,
    simulationTimeline,
  };
}
