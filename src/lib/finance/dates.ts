/**
 * AI Money Tracker — Allowance Cycle and Date Arithmetic
 * 
 * Educational Concept: Date Math and Edge Cases
 * Calendar months vary between 28, 29, 30, and 31 days.
 * If a student sets their payout on day 31, February must clamp to 28 (or 29 on leap years).
 * All calculations use UTC timestamps to avoid daylight savings / timezone jitter.
 */

/**
 * Returns the maximum number of days in a given year and month (1-indexed month: 1 = Jan, 12 = Dec).
 */
export function getDaysInMonth(year: number, month: number): number {
  // Day 0 of the NEXT month gives the last day of the current month
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Clamps a desired day of the month (e.g. 31) to the actual max days of that month.
 * E.g., for Feb 2026: desiredDay 31 -> clamped to 28.
 */
export function clampDayToMonth(year: number, month: number, desiredDay: number): number {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(Math.max(1, desiredDay), maxDays);
}

/**
 * Formats a Date object to YYYY-MM-DD in UTC.
 */
export function formatISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC.
 */
export function getTodayISO(): string {
  return formatISODate(new Date());
}

/**
 * Parses a YYYY-MM-DD string into a UTC Date object.
 */
export function parseISODate(isoDateString: string): Date {
  const [y, m, d] = isoDateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Calculates the exact whole days between two ISO dates (endDate - startDate).
 * E.g. "2026-10-15" to "2026-10-20" -> 5 days.
 */
export function getDaysDifference(startDateISO: string, endDateISO: string): number {
  const start = parseISODate(startDateISO);
  const end = parseISODate(endDateISO);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Adds a given number of days to an ISO date string and returns the new ISO date.
 */
export function addDaysToDate(isoDateString: string, days: number): string {
  const date = parseISODate(isoDateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISODate(date);
}

/**
 * Computes the active cycle's start date and next payout date based on referenceDate (today)
 * and the user's chosen cycle day of the month (1-31).
 */
export function computeCycleDates(
  referenceDateISO: string,
  cycleDayOfMonth: number
): { currentCycleStart: string; nextPayoutDate: string; daysRemaining: number; cycleTotalDays: number } {
  const ref = parseISODate(referenceDateISO);
  const refYear = ref.getUTCFullYear();
  const refMonth = ref.getUTCMonth() + 1; // 1-12
  const refDay = ref.getUTCDate();

  // Determine clamped payout day for the current month
  const clampedDayThisMonth = clampDayToMonth(refYear, refMonth, cycleDayOfMonth);

  let currentCycleStart: string;
  let nextPayoutDate: string;

  if (refDay >= clampedDayThisMonth) {
    // We are currently on or after the payout day of this month.
    // Cycle started on this month's clamped payout day.
    const startClamped = clampedDayThisMonth;
    currentCycleStart = `${refYear}-${String(refMonth).padStart(2, '0')}-${String(startClamped).padStart(2, '0')}`;

    // Next payout will be next month
    let nextMonth = refMonth + 1;
    let nextYear = refYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextClamped = clampDayToMonth(nextYear, nextMonth, cycleDayOfMonth);
    nextPayoutDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextClamped).padStart(2, '0')}`;
  } else {
    // We are before this month's payout day.
    // Cycle started in the previous month!
    let prevMonth = refMonth - 1;
    let prevYear = refYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevClamped = clampDayToMonth(prevYear, prevMonth, cycleDayOfMonth);
    currentCycleStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevClamped).padStart(2, '0')}`;

    // Next payout is this month's clamped payout day
    nextPayoutDate = `${refYear}-${String(refMonth).padStart(2, '0')}-${String(clampedDayThisMonth).padStart(2, '0')}`;
  }

  const daysRemaining = Math.max(0, getDaysDifference(referenceDateISO, nextPayoutDate));
  const cycleTotalDays = Math.max(1, getDaysDifference(currentCycleStart, nextPayoutDate));

  return {
    currentCycleStart,
    nextPayoutDate,
    daysRemaining,
    cycleTotalDays,
  };
}
