'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMoney } from '@/lib/store/MoneyContext';
import { formatPaiseToINR, rupeesToPaise } from '@/lib/finance/currency';
import { Sparkles, Calendar, ArrowRight, ShieldCheck, CheckCircle2, History } from 'lucide-react';

export function CycleRolloverModal() {
  const {
    rolloverStatus,
    rolloverCycle,
    dismissRolloverForToday,
    forecast,
    cycle,
  } = useMoney();

  const [isOpen, setIsOpen] = useState(false);
  const [allowanceInput, setAllowanceInput] = useState('');

  // Auto-open modal when rollover becomes due
  useEffect(() => {
    if (rolloverStatus && rolloverStatus.isDue) {
      setAllowanceInput((rolloverStatus.defaultAllowancePaise / 100).toString());
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [rolloverStatus]);

  if (!rolloverStatus || !rolloverStatus.isDue) {
    return null;
  }

  const currentCarryoverPaise = forecast?.currentBalancePaise ?? 0;
  const enteredAllowancePaise = rupeesToPaise(parseFloat(allowanceInput) || 0);
  const totalNewPoolPaise = currentCarryoverPaise + enteredAllowancePaise;

  const handleConfirmRollover = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredAllowancePaise <= 0) return;
    rolloverCycle(enteredAllowancePaise);
    setIsOpen(false);
  };

  const handleDismiss = () => {
    dismissRolloverForToday();
    setIsOpen(false);
  };

  return (
    <>
      {/* Alert Banner at top of page if modal is dismissed or closed */}
      {!isOpen && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/40 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                Allowance Day! {rolloverStatus.cycleMonthLabel} cycle is ready to start.
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Roll over into your new month to update your safe daily spend.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            Start New Cycle
          </Button>
        </div>
      )}

      {/* Main Rollover Modal */}
      <Modal
        isOpen={isOpen}
        onClose={handleDismiss}
        title="🎉 Welcome to Your New Allowance Cycle!"
      >
        <form onSubmit={handleConfirmRollover} className="space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Your previous cycle ended on{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-mono">
              {rolloverStatus.cycleEndDate}
            </strong>
            . Ready to record your incoming allowance for{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {rolloverStatus.cycleMonthLabel}
            </strong>
            ?
          </p>

          {/* Cashflow Carryover Summary Box */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Carried over from last month:</span>
              <span className={`font-mono font-semibold ${currentCarryoverPaise >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                {formatPaiseToINR(currentCarryoverPaise)}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Allowance Received for {rolloverStatus.cycleMonthLabel} (₹)
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                required
                value={allowanceInput}
                onChange={e => setAllowanceInput(e.target.value)}
                placeholder="e.g. 8000"
                className="font-mono text-base font-bold"
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100">
              <span>New Starting Balance:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                {formatPaiseToINR(totalNewPoolPaise)}
              </span>
            </div>
          </div>

          {/* Safety Guarantees Callout */}
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>What happens next:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
              <li>All past transactions remain safely preserved in your ledger history.</li>
              <li>Fixed bills (rent, mess, Wi-Fi) reset to unpaid for the new month.</li>
              <li>Your safe daily spend recalibrates to survive until the next payout.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDismiss}
              className="text-xs text-slate-500"
            >
              Remind Me Tomorrow
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
            >
              <span>Deposit & Start {rolloverStatus.cycleMonthLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
