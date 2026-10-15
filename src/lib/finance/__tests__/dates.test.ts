import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  clampDayToMonth,
  getDaysDifference,
  addDaysToDate,
  computeCycleDates,
} from '../dates';

describe('Allowance Dates & Calendar Math', () => {
  it('correctly reports days in different calendar months', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31);  // Jan
    expect(getDaysInMonth(2026, 2)).toBe(28);  // Feb (non leap)
    expect(getDaysInMonth(2024, 2)).toBe(29);  // Feb (leap year 2024)
    expect(getDaysInMonth(2026, 4)).toBe(30);  // April
  });

  it('clamps invalid days to the maximum day of the month', () => {
    // If student sets payout on 31st, Feb 2026 clamps to 28
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    // In April, 31 clamps to 30
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
    // Regular 15 remains 15
    expect(clampDayToMonth(2026, 4, 15)).toBe(15);
  });

  it('calculates exact day differences accurately in UTC', () => {
    expect(getDaysDifference('2026-10-15', '2026-10-25')).toBe(10);
    expect(getDaysDifference('2026-10-15', '2026-11-01')).toBe(17);
    expect(getDaysDifference('2026-10-15', '2026-10-15')).toBe(0);
  });

  it('computes cycle dates correctly when today is before the cycle payout day', () => {
    // Today is Oct 15, cycle payout day is 28th
    // Started Sept 28, Next is Oct 28
    const { currentCycleStart, nextPayoutDate, daysRemaining } = computeCycleDates('2026-10-15', 28);
    expect(currentCycleStart).toBe('2026-09-28');
    expect(nextPayoutDate).toBe('2026-10-28');
    expect(daysRemaining).toBe(13);
  });

  it('computes cycle dates correctly when today is on or after the cycle payout day', () => {
    // Today is Oct 28, cycle payout day is 28th
    // Started Oct 28, Next is Nov 28
    const { currentCycleStart, nextPayoutDate, daysRemaining } = computeCycleDates('2026-10-28', 28);
    expect(currentCycleStart).toBe('2026-10-28');
    expect(nextPayoutDate).toBe('2026-11-28');
    expect(daysRemaining).toBe(31);
  });

  it('handles year boundary rollover seamlessly (December to January)', () => {
    // Today is Dec 29, payout day is 1st of month
    // Started Dec 1, Next is Jan 1, 2027
    const { currentCycleStart, nextPayoutDate, daysRemaining } = computeCycleDates('2026-12-29', 1);
    expect(currentCycleStart).toBe('2026-12-01');
    expect(nextPayoutDate).toBe('2027-01-01');
    expect(daysRemaining).toBe(3);
  });

  it('correctly adds days across month and year boundaries', () => {
    expect(addDaysToDate('2026-10-28', 5)).toBe('2026-11-02');
    expect(addDaysToDate('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysToDate('2024-02-27', 3)).toBe('2024-03-01'); // Leap year 2024 has Feb 29
  });

  it('clamps cycle day 31 to February 29 in a leap year', () => {
    // Reference: Feb 15, 2024 (leap year). Cycle day: 31st
    // Started Jan 31, 2024. Next payout should be Feb 29, 2024!
    const { currentCycleStart, nextPayoutDate } = computeCycleDates('2024-02-15', 31);
    expect(currentCycleStart).toBe('2024-01-31');
    expect(nextPayoutDate).toBe('2024-02-29');
  });
});
