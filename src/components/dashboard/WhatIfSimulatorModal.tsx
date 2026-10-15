'use client';

import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMoney } from '@/lib/store/MoneyContext';
import { runSimulation, generateSmartRecommendations } from '@/lib/finance/simulator';
import { formatPaiseToINR, rupeesToPaise } from '@/lib/finance/currency';
import {
  Sparkles,
  ShoppingBag,
  TrendingDown,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface WhatIfSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPurchaseAmount?: number;
}

type TabType = 'purchase' | 'daily' | 'recommendations';

export function WhatIfSimulatorModal({
  isOpen,
  onClose,
  initialPurchaseAmount,
}: WhatIfSimulatorModalProps) {
  const { todayISO, cycle, transactions, recurringExpenses } = useMoney();

  const [activeTab, setActiveTab] = useState<TabType>(
    initialPurchaseAmount ? 'purchase' : 'purchase'
  );
  const [purchaseAmount, setPurchaseAmount] = useState<string>(
    initialPurchaseAmount ? String(initialPurchaseAmount) : ''
  );
  const [purchaseDescription, setPurchaseDescription] = useState<string>('');
  const [dailyDeltaRupees, setDailyDeltaRupees] = useState<number>(0);
  const [pausedBillIds, setPausedBillIds] = useState<string[]>([]);

  // Reset state when opened or closed
  const handleReset = () => {
    setPurchaseAmount('');
    setPurchaseDescription('');
    setDailyDeltaRupees(0);
    setPausedBillIds([]);
  };

  const simulationResult = useMemo(() => {
    if (!cycle) return null;

    const purchasePaise = rupeesToPaise(parseFloat(purchaseAmount) || 0);
    const deltaPaise = rupeesToPaise(dailyDeltaRupees);

    return runSimulation(
      {
        todayISO,
        cycle,
        transactions,
        recurringExpenses,
      },
      {
        oneOffExpensePaise: purchasePaise > 0 ? purchasePaise : undefined,
        dailySpendDeltaPaise: deltaPaise !== 0 ? deltaPaise : undefined,
        pausedBillIds: pausedBillIds.length > 0 ? pausedBillIds : undefined,
      }
    );
  }, [
    todayISO,
    cycle,
    transactions,
    recurringExpenses,
    purchaseAmount,
    dailyDeltaRupees,
    pausedBillIds,
  ]);

  const recommendations = useMemo(() => {
    if (!simulationResult || !cycle) return [];
    return generateSmartRecommendations(
      simulationResult.currentForecast,
      cycle.targetReservePaise,
      recurringExpenses
    );
  }, [simulationResult, cycle, recurringExpenses]);

  if (!cycle || !simulationResult) return null;

  const { currentForecast, simulatedForecast, affordabilityVerdict } =
    simulationResult;

  const isSimulating =
    (parseFloat(purchaseAmount) || 0) > 0 ||
    dailyDeltaRupees !== 0 ||
    pausedBillIds.length > 0;

  const getStatusBadge = (status: 'safe' | 'tight' | 'danger') => {
    switch (status) {
      case 'safe':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <ShieldCheck className="h-3 w-3" /> Safe
          </span>
        );
      case 'tight':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3 w-3" /> Tight
          </span>
        );
      case 'danger':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <AlertCircle className="h-3 w-3" /> Danger
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="What-If Spend Simulator"
      description="Simulate the impact of purchases or daily budget adjustments on your survival runway without affecting your real data."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('purchase')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'purchase'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Test a Purchase</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            <span>Adjust Daily Spend</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recommendations')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              activeTab === 'recommendations'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
            <span>Smart Recommendations</span>
            {recommendations.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                {recommendations.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Test a Purchase */}
        {activeTab === 'purchase' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Item or Purpose
                </label>
                <Input
                  placeholder="e.g. New Shoes, Concert Ticket"
                  value={purchaseDescription}
                  onChange={e => setPurchaseDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Price in Rupees (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="10"
                  placeholder="e.g. 1800"
                  value={purchaseAmount}
                  onChange={e => setPurchaseAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Amount Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 text-[11px] font-medium mr-1">
                Quick test:
              </span>
              {[250, 500, 1000, 1500, 2000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPurchaseAmount(String(amt))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:border-slate-400 hover:bg-white transition-colors cursor-pointer font-medium text-xs"
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {/* Affordability Verdict Banner */}
            {affordabilityVerdict && (
              <div
                className={`rounded-2xl border p-4 ${
                  affordabilityVerdict.status === 'safe'
                    ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                    : affordabilityVerdict.status === 'tight'
                    ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                    : 'border-rose-200 bg-rose-50/80 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {affordabilityVerdict.status === 'safe' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : affordabilityVerdict.status === 'tight' ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold">
                      {affordabilityVerdict.summary}
                    </h4>
                    <p className="mt-1 text-xs opacity-90 leading-relaxed">
                      {affordabilityVerdict.details}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Adjust Daily Spend */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600 leading-relaxed">
              Test how spending slightly more or less each day impacts your final balance by payout day ({currentForecast.daysRemaining} days remaining).
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Daily adjustment:</span>
              {[-100, -50, -30, 0, 30, 50, 100].map(delta => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => setDailyDeltaRupees(delta)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    dailyDeltaRupees === delta
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {delta === 0 ? 'No change' : delta > 0 ? `+₹${delta}/day` : `-₹${Math.abs(delta)}/day`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-150"
                max="150"
                step="10"
                value={dailyDeltaRupees}
                onChange={e => setDailyDeltaRupees(parseInt(e.target.value, 10))}
                className="w-full accent-slate-900"
              />
              <span className="font-mono text-xs font-bold text-slate-800 w-24 text-right">
                {dailyDeltaRupees === 0
                  ? '₹0/day'
                  : dailyDeltaRupees > 0
                  ? `+₹${dailyDeltaRupees}/day`
                  : `-₹${Math.abs(dailyDeltaRupees)}/day`}
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Smart Recommendations */}
        {activeTab === 'recommendations' && (
          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
                You're already following optimal spending habits for this cycle!
              </div>
            ) : (
              recommendations.map(rec => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 transition-all hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          {rec.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                          {rec.explanation}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (rec.category === 'micro_savings') {
                          setDailyDeltaRupees(-30);
                          setActiveTab('daily');
                        } else if (rec.category === 'burn_rate') {
                          const diff =
                            Math.round(
                              (currentForecast.safeDailySpendPaise -
                                currentForecast.recentDailySpendPaise) /
                                100
                            );
                          setDailyDeltaRupees(diff);
                          setActiveTab('daily');
                        }
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <span>Simulate</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Impact Comparison Box */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Scenario Comparison
            </h4>
            {isSimulating && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset Scenario</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {/* Safe Daily Spend */}
            <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Safe Daily Spend
              </span>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 line-through">
                  {formatPaiseToINR(currentForecast.safeDailySpendPaise)}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {formatPaiseToINR(simulatedForecast.safeDailySpendPaise)}
                </span>
              </div>
            </div>

            {/* Projected End Balance */}
            <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                Projected Balance
              </span>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 line-through">
                  {formatPaiseToINR(currentForecast.projectedEndBalancePaise)}
                </span>
                <span
                  className={`text-sm font-bold ${
                    simulatedForecast.projectedEndBalancePaise <
                    cycle.targetReservePaise
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatPaiseToINR(simulatedForecast.projectedEndBalancePaise)}
                </span>
              </div>
            </div>

            {/* Survival Status */}
            <div className="rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                Survival Status
              </span>
              {getStatusBadge(simulatedForecast.status)}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>
            Close Simulator
          </Button>
        </div>
      </div>
    </Modal>
  );
}
