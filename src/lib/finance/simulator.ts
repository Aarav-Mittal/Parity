import {
  ForecastInput,
  calculateForecast,
  getUpcomingCommittedBills,
  calculateSpendingVelocity,
} from './forecast';
import {
  SimulationAdjustment,
  SimulationResult,
  SmartRecommendation,
} from '@/types/simulator';
import {
  DailyProjection,
  ForecastResult,
  RecurringExpense,
  SurvivalStatus,
  Transaction,
} from '@/types/finance';
import { addDaysToDate, getDaysDifference } from './dates';
import { formatPaiseToINR } from './currency';
import { MonthlyAnalyticsSummary } from '@/types/alerts';

/**
 * Runs a deterministic simulation given a set of hypothetical adjustments.
 */
export function runSimulation(
  input: ForecastInput,
  adjustments: SimulationAdjustment = {}
): SimulationResult {
  const currentForecast = calculateForecast(input);
  const { todayISO, cycle, transactions, recurringExpenses } = input;

  // 1. Prepare simulated transactions
  const simulatedTransactions: Transaction[] = [...transactions];

  if (adjustments.oneOffExpensePaise && adjustments.oneOffExpensePaise > 0) {
    simulatedTransactions.unshift({
      id: 'sim-expense-oneoff',
      userId: cycle.userId,
      type: 'expense',
      amountPaise: adjustments.oneOffExpensePaise,
      description: 'Hypothetical Purchase',
      transactionDate: todayISO,
      createdAt: todayISO,
      isOneOff: true, // Prevents distorting daily velocity heuristic
    });
  }

  if (adjustments.oneOffIncomePaise && adjustments.oneOffIncomePaise > 0) {
    simulatedTransactions.unshift({
      id: 'sim-income-oneoff',
      userId: cycle.userId,
      type: 'income',
      amountPaise: adjustments.oneOffIncomePaise,
      description: 'Hypothetical Top-up',
      transactionDate: todayISO,
      createdAt: todayISO,
    });
  }

  // 2. Prepare simulated recurring obligations
  const pausedSet = new Set(adjustments.pausedBillIds || []);
  const simulatedRecurring: RecurringExpense[] = recurringExpenses.map(b =>
    pausedSet.has(b.id) ? { ...b, isPaused: true } : b
  );

  // 3. Compute baseline simulated forecast
  const baseSimForecast = calculateForecast({
    todayISO,
    cycle,
    transactions: simulatedTransactions,
    recurringExpenses: simulatedRecurring,
  });

  // 4. If daily spend delta is requested, adjust day-by-day cashflow simulation
  let simulatedForecast = baseSimForecast;

  if (adjustments.dailySpendDeltaPaise && adjustments.dailySpendDeltaPaise !== 0) {
    simulatedForecast = applyDailySpendDelta(
      baseSimForecast,
      adjustments.dailySpendDeltaPaise,
      input,
      simulatedRecurring
    );
  }

  // 5. Compute deltas
  const balanceDeltaPaise =
    simulatedForecast.projectedEndBalancePaise -
    currentForecast.projectedEndBalancePaise;

  const safeSpendDeltaPaise =
    simulatedForecast.safeDailySpendPaise - currentForecast.safeDailySpendPaise;

  // Calculate runway change in days
  const currentRunway = currentForecast.projectedRunOutDate
    ? getDaysDifference(todayISO, currentForecast.projectedRunOutDate)
    : currentForecast.daysRemaining;

  const simulatedRunway = simulatedForecast.projectedRunOutDate
    ? getDaysDifference(todayISO, simulatedForecast.projectedRunOutDate)
    : simulatedForecast.daysRemaining;

  const runwayDaysDelta = simulatedRunway - currentRunway;

  // 6. Affordability verdict if an expense was simulated
  let affordabilityVerdict: SimulationResult['affordabilityVerdict'];

  if (adjustments.oneOffExpensePaise && adjustments.oneOffExpensePaise > 0) {
    const expenseFormatted = formatPaiseToINR(adjustments.oneOffExpensePaise);
    const newSafeDaily = formatPaiseToINR(simulatedForecast.safeDailySpendPaise);

    if (simulatedForecast.status === 'safe') {
      affordabilityVerdict = {
        isAffordable: true,
        status: 'safe',
        summary: `Easily affordable (${expenseFormatted})`,
        details: `Your balance stays comfortably above your reserve target of ${formatPaiseToINR(
          cycle.targetReservePaise
        )} through payout day. Your new safe daily spend will be ${newSafeDaily}/day.`,
      };
    } else if (simulatedForecast.status === 'tight') {
      affordabilityVerdict = {
        isAffordable: true,
        status: 'tight',
        summary: `Affordable, but tight (${expenseFormatted})`,
        details: `You can buy this, but your safe daily spend drops to ${newSafeDaily}/day and your safety cushion will be tested before payout day.`,
      };
    } else {
      const daysEarly = simulatedForecast.projectedRunOutDate
        ? getDaysDifference(
            simulatedForecast.projectedRunOutDate,
            cycle.nextPayoutDate
          )
        : 0;

      affordabilityVerdict = {
        isAffordable: false,
        status: 'danger',
        summary: `Not recommended (${expenseFormatted})`,
        details: `This purchase will cause your funds to run out around ${
          simulatedForecast.projectedRunOutDate || 'payout day'
        } (${daysEarly} days before your next allowance).`,
      };
    }
  }

  return {
    currentForecast,
    simulatedForecast,
    balanceDeltaPaise,
    safeSpendDeltaPaise,
    runwayDaysDelta,
    affordabilityVerdict,
  };
}

/**
 * Re-runs cashflow simulation with a modified daily spend velocity.
 */
function applyDailySpendDelta(
  baseForecast: ForecastResult,
  dailySpendDeltaPaise: number,
  input: ForecastInput,
  recurringExpenses: RecurringExpense[]
): ForecastResult {
  const { todayISO, cycle } = input;
  const newVelocityPaise = Math.max(
    0,
    baseForecast.recentDailySpendPaise + dailySpendDeltaPaise
  );

  const { billsDueByDate } = getUpcomingCommittedBills(
    recurringExpenses,
    todayISO,
    cycle.nextPayoutDate,
    cycle.currentCycleStart
  );

  const simulationTimeline: DailyProjection[] = [];
  let simulatedBalance = baseForecast.currentBalancePaise;
  let projectedRunOutDate: string | null = null;
  let firstBelowReserveDate: string | null = null;

  for (let d = 0; d < baseForecast.daysRemaining; d++) {
    const simDate = addDaysToDate(todayISO, d);
    const dayBills = billsDueByDate.get(simDate) || 0;
    const daySpend = newVelocityPaise;

    const openingForDay = simulatedBalance;
    const closingForDay = openingForDay - dayBills - daySpend;

    const isBelowReserve = closingForDay < cycle.targetReservePaise;
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

  // Determine status under adjusted spend
  let status: SurvivalStatus;
  let statusHeadline: string;
  let statusMessage: string;

  if (baseForecast.currentBalancePaise <= 0 || projectedRunOutDate !== null) {
    status = 'danger';
    statusHeadline = 'Projected shortfall before next allowance';
    statusMessage = `Projected to run out on ${projectedRunOutDate || 'payout day'}.`;
  } else if (
    firstBelowReserveDate !== null ||
    newVelocityPaise > baseForecast.safeDailySpendPaise
  ) {
    status = 'tight';
    statusHeadline = "You're on track, but your budget is tight";
    statusMessage = `Balance will hold, but spending velocity exceeds safe pace.`;
  } else {
    status = 'safe';
    statusHeadline = "You're on track to make it to your next allowance";
    statusMessage = `On track to reach next payout with reserve intact.`;
  }

  return {
    ...baseForecast,
    recentDailySpendPaise: newVelocityPaise,
    projectedEndBalancePaise: simulatedBalance,
    projectedRunOutDate,
    status,
    statusHeadline,
    statusMessage,
    simulationTimeline,
  };
}

/**
 * Generates actionable, student-centric spending recommendations based on real cycle math.
 */
export function generateSmartRecommendations(
  forecast: ForecastResult,
  targetReservePaise: number = 50000,
  recurringExpenses: RecurringExpense[] = []
): SmartRecommendation[] {
  const recommendations: SmartRecommendation[] = [];
  const daysLeft = Math.max(1, forecast.daysRemaining);

  // 1. Chai & Snack Micro-Savings Rule
  // Cutting ₹30-50/day on daily treats
  const dailyMicroSavingPaise = 3000; // ₹30/day
  const microSavingTotalPaise = dailyMicroSavingPaise * daysLeft;
  recommendations.push({
    id: 'rec-micro-savings',
    title: 'Cut ₹30/day on Chai & Snacks',
    category: 'micro_savings',
    impactPaise: microSavingTotalPaise,
    actionText: `Saves ${formatPaiseToINR(microSavingTotalPaise)} by payout`,
    recommendedDailySpendPaise: Math.max(0, forecast.recentDailySpendPaise - dailyMicroSavingPaise),
    explanation: `Trimming just ₹30/day on canteen tea or snacks adds ${formatPaiseToINR(
      microSavingTotalPaise
    )} back into your discretionary cushion before next payout.`,
  });

  // 2. Pace Correction if Burn Rate is Excessive
  if (forecast.recentDailySpendPaise > forecast.safeDailySpendPaise) {
    const excessDailyPaise = forecast.recentDailySpendPaise - forecast.safeDailySpendPaise;
    const totalWastedPaise = excessDailyPaise * daysLeft;
    recommendations.push({
      id: 'rec-burn-rate',
      title: 'Target Safe Daily Spending Cap',
      category: 'burn_rate',
      impactPaise: totalWastedPaise,
      actionText: `Cap spend at ${formatPaiseToINR(forecast.safeDailySpendPaise)}/day`,
      recommendedDailySpendPaise: forecast.safeDailySpendPaise,
      explanation: `You are currently spending ${formatPaiseToINR(
        excessDailyPaise
      )}/day over your safe limit. Slowing down to ${formatPaiseToINR(
        forecast.safeDailySpendPaise
      )}/day guarantees your money survives to payout.`,
    });
  }

  // 3. Bill Optimization / Pausing
  const unpausedSubscriptions = recurringExpenses.filter(
    b => !b.isPaused && b.amountPaise < 100000 && b.name.toLowerCase().match(/netflix|spotify|prime|hotstar|youtube/)
  );
  if (unpausedSubscriptions.length > 0 && forecast.status !== 'safe') {
    const firstSub = unpausedSubscriptions[0];
    recommendations.push({
      id: `rec-pause-${firstSub.id}`,
      title: `Temporarily Pause ${firstSub.name}`,
      category: 'bill_optimization',
      impactPaise: firstSub.amountPaise,
      actionText: `Free up ${formatPaiseToINR(firstSub.amountPaise)} this month`,
      explanation: `Pausing your ${firstSub.name} subscription this cycle instantly preserves ${formatPaiseToINR(
        firstSub.amountPaise
      )} in emergency cash.`,
    });
  }

  // 4. Reserve Recovery if Cushion is Breached
  const dipsBelowReserve =
    forecast.projectedEndBalancePaise < targetReservePaise ||
    forecast.simulationTimeline.some(d => d.isBelowReserve);

  if (dipsBelowReserve && forecast.status !== 'danger') {
    const dailyTrimToSaveReserve = Math.ceil(targetReservePaise / daysLeft);
    recommendations.push({
      id: 'rec-reserve-recovery',
      title: 'Protect Safety Cushion',
      category: 'reserve_recovery',
      impactPaise: targetReservePaise,
      actionText: `Save ${formatPaiseToINR(dailyTrimToSaveReserve)}/day to keep reserve`,
      recommendedDailySpendPaise: Math.max(0, forecast.recentDailySpendPaise - dailyTrimToSaveReserve),
      explanation: `Your projected balance dips into your emergency reserve. Spending ${formatPaiseToINR(
        dailyTrimToSaveReserve
      )}/day less keeps your safety net intact.`,
    });
  }

  return recommendations;
}
