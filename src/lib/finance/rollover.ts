import { AllowanceCycle, RecurringExpense, Transaction } from '@/types/finance';
import { computeCycleDates, parseISODate } from './dates';

export interface RolloverPreview {
  isDue: boolean;
  daysOverdue: number;
  currentCycleStart: string;
  cycleEndDate: string;
  newCycleStart: string;
  newNextPayoutDate: string;
  defaultAllowancePaise: number;
  cycleMonthLabel: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Inspects whether the active cycle has reached or passed its nextPayoutDate.
 */
export function checkRolloverStatus(
  referenceDateISO: string,
  cycle: AllowanceCycle | null
): RolloverPreview | null {
  if (!cycle || !cycle.isActive) return null;

  const isDue = referenceDateISO >= cycle.nextPayoutDate;
  const newCycleStart = cycle.nextPayoutDate;
  const newCycleDates = computeCycleDates(newCycleStart, cycle.cycleDayOfMonth);

  const targetDateObj = parseISODate(newCycleStart);
  const cycleMonthLabel = `${MONTH_NAMES[targetDateObj.getUTCMonth()]} ${targetDateObj.getUTCFullYear()}`;

  return {
    isDue,
    daysOverdue: Math.max(0, Math.round((parseISODate(referenceDateISO).getTime() - parseISODate(cycle.nextPayoutDate).getTime()) / (1000 * 60 * 60 * 24))),
    currentCycleStart: cycle.currentCycleStart,
    cycleEndDate: cycle.nextPayoutDate,
    newCycleStart: newCycleDates.currentCycleStart,
    newNextPayoutDate: newCycleDates.nextPayoutDate,
    defaultAllowancePaise: cycle.allowanceAmountPaise,
    cycleMonthLabel,
  };
}

/**
 * Creates the updated cycle and allowance income transaction for the new month.
 */
export function executeCycleRollover(params: {
  currentCycle: AllowanceCycle;
  todayISO: string;
  newAllowancePaise?: number;
  incomeCategoryId?: string | null;
}): {
  updatedCycle: AllowanceCycle;
  newAllowanceTransaction: Omit<Transaction, 'id' | 'createdAt'>;
} {
  const { currentCycle, todayISO, newAllowancePaise, incomeCategoryId } = params;
  const allowancePaise = newAllowancePaise ?? currentCycle.allowanceAmountPaise;

  const newCycleStart = currentCycle.nextPayoutDate;
  const newDates = computeCycleDates(newCycleStart, currentCycle.cycleDayOfMonth);

  const startObj = parseISODate(newDates.currentCycleStart);
  const monthName = MONTH_NAMES[startObj.getUTCMonth()];
  const year = startObj.getUTCFullYear();

  const updatedCycle: AllowanceCycle = {
    ...currentCycle,
    id: `cycle-${Date.now()}`,
    currentCycleStart: newDates.currentCycleStart,
    nextPayoutDate: newDates.nextPayoutDate,
    allowanceAmountPaise: allowancePaise,
    isActive: true,
  };

  const newAllowanceTransaction: Omit<Transaction, 'id' | 'createdAt'> = {
    userId: currentCycle.userId,
    categoryId: incomeCategoryId || null,
    amountPaise: allowancePaise,
    type: 'income',
    description: `${monthName} ${year} Allowance`,
    transactionDate: todayISO >= newDates.currentCycleStart ? todayISO : newDates.currentCycleStart,
    isOneOff: true,
    isCorrection: false,
    correctedFromId: null,
    rawInput: 'cycle-rollover',
  };

  return {
    updatedCycle,
    newAllowanceTransaction,
  };
}
