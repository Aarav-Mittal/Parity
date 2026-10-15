'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { SurvivalBadge } from '@/components/ui/Badge';
import { useMoney } from '@/lib/store/MoneyContext';
import { formatPaiseToINR } from '@/lib/finance/currency';
import { Calendar, ShieldCheck, AlertCircle, Clock, TrendingDown } from 'lucide-react';

export function DashboardHero() {
  const { forecast, cycle, todayISO } = useMoney();

  if (!forecast || !cycle) {
    return null;
  }

  const {
    currentBalancePaise,
    daysRemaining,
    safeDailySpendPaise,
    status,
    statusHeadline,
    statusMessage,
    committedBillsPaise,
    targetReservePaise = cycle.targetReservePaise,
    recentDailySpendPaise,
    isDataSufficient,
  } = {
    ...forecast,
    targetReservePaise: cycle.targetReservePaise,
  };

  const formattedBalance = formatPaiseToINR(currentBalancePaise);
  const formattedSafeDaily = formatPaiseToINR(safeDailySpendPaise);
  const formattedCommitted = formatPaiseToINR(committedBillsPaise);
  const formattedReserve = formatPaiseToINR(targetReservePaise);
  const formattedRecent = formatPaiseToINR(recentDailySpendPaise);

  return (
    <Card className="border-slate-200/90 bg-white">
      {/* Top Header: Survival Status + Days Remaining */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <SurvivalBadge status={status} />
          <span className="text-xs font-medium text-slate-500">
            {cycle.nextPayoutDate ? `Next allowance: ${cycle.nextPayoutDate}` : ''}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>{daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining</span>
        </div>
      </div>

      {/* Main Core Metric: Remaining Balance */}
      <div className="pt-5 pb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Current Available Money
        </span>
        <div className="mt-1 flex items-baseline gap-3">
          <span className={`text-4xl sm:text-5xl font-bold tracking-tight ${
            currentBalancePaise <= 0 ? 'text-rose-600' : 'text-slate-900'
          }`}>
            {formattedBalance}
          </span>
          <span className="text-xs text-slate-400">ledger verified</span>
        </div>
      </div>

      {/* Natural Language Prediction Box */}
      <div className={`rounded-xl p-4 text-sm ${
        status === 'danger'
          ? 'bg-rose-50 border border-rose-200/80 text-rose-900'
          : status === 'tight'
          ? 'bg-amber-50 border border-amber-200/80 text-amber-900'
          : 'bg-emerald-50 border border-emerald-200/80 text-emerald-900'
      }`}>
        <p className="font-semibold">{statusHeadline}</p>
        <p className="mt-1 text-xs sm:text-sm leading-relaxed opacity-90">{statusMessage}</p>
      </div>

      {/* 3 Metric Pills: Safe Daily Spend, Reserved for Bills, Emergency Cushion */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 pt-4 border-t border-slate-100">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Safe Daily Spend</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {formattedSafeDaily}
            <span className="text-xs font-normal text-slate-500"> / day</span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">To stay within budget</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Reserved for Bills</span>
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {formattedCommitted}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Upcoming scheduled bills</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Safety Cushion</span>
            <AlertCircle className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {formattedReserve}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Protected reserve target</p>
        </div>
      </div>
    </Card>
  );
}
