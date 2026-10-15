import { ForecastResult, SurvivalStatus } from './finance';

export interface SimulationAdjustment {
  /** Hypothetical one-off purchase in minor units (paise) */
  oneOffExpensePaise?: number;
  /** Hypothetical top-up / gift / freelance income in minor units (paise) */
  oneOffIncomePaise?: number;
  /** Change to daily living spend in paise (e.g. -5000 for -₹50/day, +3000 for +₹30/day) */
  dailySpendDeltaPaise?: number;
  /** IDs of recurring bills to simulate pausing */
  pausedBillIds?: string[];
}

export interface SimulationResult {
  currentForecast: ForecastResult;
  simulatedForecast: ForecastResult;
  /** Difference in projected closing balance (paise) */
  balanceDeltaPaise: number;
  /** Difference in safe daily spend (paise) */
  safeSpendDeltaPaise: number;
  /** Difference in runway / days survived (+/- days) */
  runwayDaysDelta: number;
  /** Plain English affordability verdict if a purchase was tested */
  affordabilityVerdict?: {
    isAffordable: boolean;
    status: SurvivalStatus;
    summary: string;
    details: string;
  };
}

export interface SmartRecommendation {
  id: string;
  title: string;
  category: 'micro_savings' | 'burn_rate' | 'bill_optimization' | 'reserve_recovery';
  impactPaise: number;
  actionText: string;
  recommendedDailySpendPaise?: number;
  explanation: string;
}
