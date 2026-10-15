import {
  Transaction,
  RecurringExpense,
  AllowanceCycle,
  ForecastResult,
  DailyProjection,
  SurvivalStatus,
} from '@/types/finance';
import { calculateLedgerBalance, filterTransactionsByDateRange, getEffectiveTransactions } from './ledger';
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
 * Calculates the median of an array of numbers.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Checks if a given ISO date (YYYY-MM-DD) falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(isoDateString: string): boolean {
  const date = parseISODate(isoDateString);
  const day = date.getUTCDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

export interface SpendingVelocityDetails {
  velocityPaise: number;
  isDataSufficient: boolean;
  oneOffExpensesPaise: number;
  livingExpensesPaise: number;
  outlierCount: number;
}

/**
 * Computes the user's spending burn rate / velocity with robust outlier and one-off handling.
 * 
 * Educational Principles:
 * 1. Capital / One-Off Expenses (e.g. ₹2,500 semester textbook, laptop repair) are NEVER
 *    projected as daily recurring habits. They reduce the current ledger balance (money is spent),
 *    which safely lowers the safe daily spend, but does NOT artificially spike daily living velocity.
 * 2. Regular Weekend Lifestyle (e.g. ₹350 on Saturday vs ₹120 on weekdays) is a recurring weekly
 *    pattern, NOT an outlier. A 7-day rolling window naturally captures the 5-weekday + 2-weekend cadence.
 * 3. Cold Start (< 3 days): Uses conservative safe daily spend and flags isDataSufficient = false.
 */
export function calculateSpendingVelocity(
  transactions: Transaction[],
  cycleStartISO: string,
  todayISO: string,
  defaultSafeDailyPaise: number
): SpendingVelocityDetails {
  // Use effective transactions (filters out any superseded corrections)
  const effective = getEffectiveTransactions(transactions);

  // Filter variable cycle expenses up to today (excluding fixed recurring bills)
  const variableExpenses = effective.filter(
    tx => tx.type === 'expense' && 
          tx.transactionDate >= cycleStartISO && 
          tx.transactionDate <= todayISO &&
          !tx.recurringExpenseId
  );

  const daysElapsed = Math.max(1, getDaysDifference(cycleStartISO, todayISO) + 1);

  // 1. Separate explicitly marked one-off expenses OR automatically detect large capital transactions
  let explicitOneOffTotalPaise = 0;
  let autoDetectedOneOffPaise = 0;
  const candidateLivingExpenses: Transaction[] = [];

  // Determine a baseline for normal everyday transactions (e.g. meals, transport, snacks)
  const nonOneOffTx = variableExpenses.filter(tx => !tx.isOneOff);
  const normalTxAmounts = nonOneOffTx
    .map(tx => tx.amountPaise)
    .filter(amt => amt <= Math.max(3.0 * defaultSafeDailyPaise, 60000)); // <= ₹600 or 3x safe daily
  const typicalTxMedian = normalTxAmounts.length > 0 
    ? calculateMedian(normalTxAmounts) 
    : Math.max(defaultSafeDailyPaise, 15000);

  for (const tx of variableExpenses) {
    if (tx.isOneOff) {
      explicitOneOffTotalPaise += tx.amountPaise;
      continue;
    }

    // Auto-detect large single transactions (e.g. ₹1,800 textbook, ₹2,500 shoes, ₹3,000 phone repair)
    // A single transaction is auto-detected as an isolated capital one-off if:
    // - It is >= ₹1,000 (100,000 paise)
    // - AND it is >= 3.0x typical transaction median
    // - AND it is >= 2.0x recommended safe daily spend
    const isCapitalSpike = tx.amountPaise >= 100000 && 
                          tx.amountPaise >= 3.0 * typicalTxMedian && 
                          tx.amountPaise >= 2.0 * defaultSafeDailyPaise;

    if (isCapitalSpike) {
      autoDetectedOneOffPaise += tx.amountPaise;
    } else {
      candidateLivingExpenses.push(tx);
    }
  }

  const initialOneOffTotal = explicitOneOffTotalPaise + autoDetectedOneOffPaise;

  // Cold start guard: if fewer than 3 days have elapsed or fewer than 2 living expenses recorded
  if (daysElapsed < 3 || candidateLivingExpenses.length < 2) {
    return {
      velocityPaise: defaultSafeDailyPaise,
      isDataSufficient: false,
      oneOffExpensesPaise: initialOneOffTotal,
      livingExpensesPaise: candidateLivingExpenses.reduce((sum, tx) => sum + tx.amountPaise, 0),
      outlierCount: variableExpenses.filter(tx => tx.isOneOff).length + (autoDetectedOneOffPaise > 0 ? 1 : 0),
    };
  }

  // 2. Aggregate remaining candidate daily spending by date
  const dailySpendMap = new Map<string, number>();
  for (const tx of candidateLivingExpenses) {
    const current = dailySpendMap.get(tx.transactionDate) || 0;
    dailySpendMap.set(tx.transactionDate, current + tx.amountPaise);
  }

  // Calculate median active daily spend across days with spending
  const activeDailySpends = Array.from(dailySpendMap.values()).filter(s => s > 0);
  const medianActiveSpend = calculateMedian(activeDailySpends);

  // 3. Statistical Outlier Detection on daily aggregates (for clusters of smaller purchases on one day)
  let statisticalClusterExcessPaise = 0;
  const livingDailySpendMap = new Map<string, number>();

  for (const [dateISO, dailyTotal] of dailySpendMap.entries()) {
    const isWeekendDay = isWeekend(dateISO);
    // On weekends, spending is often higher; use a higher tolerance (5x) unless it's a massive capital purchase
    const outlierMultiplier = isWeekendDay ? 5.0 : 3.5;
    const isSpike = dailyTotal > outlierMultiplier * medianActiveSpend && 
                    dailyTotal > 2.0 * defaultSafeDailyPaise;

    if (isSpike) {
      // Treat the excess over typical daily spend as a one-off cluster purchase
      const excess = dailyTotal - medianActiveSpend;
      statisticalClusterExcessPaise += excess;
      livingDailySpendMap.set(dateISO, medianActiveSpend);
    } else {
      livingDailySpendMap.set(dateISO, dailyTotal);
    }
  }

  const totalOneOffPaise = initialOneOffTotal + statisticalClusterExcessPaise;
  const outlierCount = variableExpenses.filter(tx => tx.isOneOff).length + 
                       (autoDetectedOneOffPaise > 0 ? 1 : 0) + 
                       (statisticalClusterExcessPaise > 0 ? 1 : 0);
  const livingDailyTotals = Array.from(livingDailySpendMap.values());
  const totalLivingExpensePaise = livingDailyTotals.reduce((sum, s) => sum + s, 0);

  // 4. Calculate regular living burn rate
  let velocityPaise: number;

  if (daysElapsed >= 7) {
    // 7-day rolling window naturally balances 5 weekdays + 2 weekend days
    const sevenDaysAgoISO = addDaysToDate(todayISO, -6);
    let last7DaysLivingTotal = 0;
    for (let d = 0; d < 7; d++) {
      const dayDate = addDaysToDate(sevenDaysAgoISO, d);
      last7DaysLivingTotal += livingDailySpendMap.get(dayDate) || 0;
    }
    const weeklyAverage = Math.round(last7DaysLivingTotal / 7);
    const cycleLivingAverage = Math.round(totalLivingExpensePaise / daysElapsed);

    velocityPaise = Math.round(0.7 * weeklyAverage + 0.3 * cycleLivingAverage);
  } else {
    // 3 to 6 days elapsed: 3-day recent window + cycle average
    const threeDaysAgoISO = addDaysToDate(todayISO, -2);
    let recent3DaysLivingTotal = 0;
    for (let d = 0; d < 3; d++) {
      const dayDate = addDaysToDate(threeDaysAgoISO, d);
      recent3DaysLivingTotal += livingDailySpendMap.get(dayDate) || 0;
    }
    const recent3DayAverage = Math.round(recent3DaysLivingTotal / 3);
    const cycleLivingAverage = Math.round(totalLivingExpensePaise / daysElapsed);

    velocityPaise = Math.round(0.7 * recent3DayAverage + 0.3 * cycleLivingAverage);
  }

  return {
    velocityPaise: Math.max(0, velocityPaise),
    isDataSufficient: true,
    oneOffExpensesPaise: totalOneOffPaise,
    livingExpensesPaise: totalLivingExpensePaise,
    outlierCount,
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
  const { 
    velocityPaise: recentDailySpendPaise, 
    isDataSufficient,
    oneOffExpensesPaise,
  } = calculateSpendingVelocity(
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
  const formattedOneOff = formatPaiseToINR(oneOffExpensesPaise);

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
    if (oneOffExpensesPaise > 0) {
      statusMessage += ` (Factoring out ${formattedOneOff} in one-off expenses, your daily living pace is ${formattedVelocity}/day.)`;
    }
  } else {
    status = 'safe';
    statusHeadline = "You're on track to make it to your next allowance";
    if (isDataSufficient) {
      statusMessage = `Spending around ${formattedVelocity}/day is well within your safe limit of ${formattedSafeSpend}/day. You are projected to finish with ${formattedEndBalance} remaining.`;
      if (oneOffExpensesPaise > 0) {
        statusMessage += ` (Factoring out ${formattedOneOff} in one-off expenses, your regular living pace is ${formattedVelocity}/day.)`;
      }
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
    oneOffExpensesPaise,
    simulationTimeline,
  };
}
