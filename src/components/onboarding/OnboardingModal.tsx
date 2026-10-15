'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMoney } from '@/lib/store/MoneyContext';
import { rupeesToPaise, formatPaiseToINR } from '@/lib/finance/currency';
import { ArrowRight, ArrowLeft, CheckCircle2, Plus, Trash2 } from 'lucide-react';

interface RecurringDraft {
  name: string;
  amountRupees: string;
  dueDayOfMonth: number;
}

export function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { completeOnboarding, todayISO } = useMoney();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [allowanceRupees, setAllowanceRupees] = useState('8000');
  const [cycleDay, setCycleDay] = useState('1');
  const [currentBalanceRupees, setCurrentBalanceRupees] = useState('8000');
  const [targetReserveRupees, setTargetReserveRupees] = useState('500');

  // Recurring draft list
  const [recurringList, setRecurringList] = useState<RecurringDraft[]>([
    { name: 'Room Rent', amountRupees: '2500', dueDayOfMonth: 5 },
    { name: 'Hostel Wi-Fi', amountRupees: '499', dueDayOfMonth: 10 },
  ]);

  const [newRecName, setNewRecName] = useState('');
  const [newRecAmount, setNewRecAmount] = useState('');
  const [newRecDay, setNewRecDay] = useState('15');

  const addRecurringItem = () => {
    if (!newRecName || !newRecAmount) return;
    setRecurringList(prev => [
      ...prev,
      {
        name: newRecName,
        amountRupees: newRecAmount,
        dueDayOfMonth: parseInt(newRecDay, 10) || 1,
      },
    ]);
    setNewRecName('');
    setNewRecAmount('');
    setNewRecDay('15');
  };

  const removeRecurringItem = (index: number) => {
    setRecurringList(prev => prev.filter((_, i) => i !== index));
  };

  const handleFinish = () => {
    const allowancePaise = rupeesToPaise(parseFloat(allowanceRupees) || 0);
    const balancePaise = rupeesToPaise(parseFloat(currentBalanceRupees) || 0);
    const reservePaise = rupeesToPaise(parseFloat(targetReserveRupees) || 500);
    const day = Math.min(31, Math.max(1, parseInt(cycleDay, 10) || 1));

    const mappedRecurring = recurringList.map(item => ({
      name: item.name,
      amountPaise: rupeesToPaise(parseFloat(item.amountRupees) || 0),
      dueDayOfMonth: item.dueDayOfMonth,
    }));

    completeOnboarding({
      allowanceAmountPaise: allowancePaise,
      cycleDayOfMonth: day,
      openingBalancePaise: balancePaise,
      targetReservePaise: reservePaise,
      recurringExpenses: mappedRecurring,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set Up Your Student Budget"
      description={`Step ${step} of 4 — Let's figure out how long your money will last.`}
      maxWidth="lg"
    >
      <div className="mt-2 space-y-6">
        {/* Step 1: Allowance & Cadence */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              How much allowance, pocket money, or stipend do you receive, and on what day does it arrive?
            </p>
            <Input
              label="Monthly Allowance / Income (₹)"
              type="number"
              prefixSymbol="₹"
              value={allowanceRupees}
              onChange={e => setAllowanceRupees(e.target.value)}
              placeholder="8000"
              helperText="E.g. ₹8,000 from parents or stipend"
            />
            <Input
              label="Payout Day of Month (1 - 31)"
              type="number"
              min={1}
              max={31}
              value={cycleDay}
              onChange={e => setCycleDay(e.target.value)}
              helperText="E.g. 1st of every month, or 28th"
            />
          </div>
        )}

        {/* Step 2: Current Available Balance */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              How much money do you currently have available in your bank account and pocket right now?
            </p>
            <Input
              label="Current Available Balance (₹)"
              type="number"
              prefixSymbol="₹"
              value={currentBalanceRupees}
              onChange={e => setCurrentBalanceRupees(e.target.value)}
              placeholder="8000"
              helperText="This sets your starting point for this month's survival forecast."
            />
          </div>
        )}

        {/* Step 3: Fixed Recurring Commitments */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Do you have predictable monthly obligations (Hostel rent, Wi-Fi, Spotify, Gym)? We reserve this money so you don't accidentally spend it.
            </p>

            <div className="space-y-2">
              {recurringList.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{rec.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      ₹{rec.amountRupees} • Due day {rec.dueDayOfMonth}
                    </span>
                  </div>
                  <button
                    onClick={() => removeRecurringItem(idx)}
                    className="text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 p-3 bg-white space-y-3">
              <span className="text-xs font-semibold uppercase text-slate-500">Add an upcoming bill</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  placeholder="Bill name (e.g. Wi-Fi)"
                  value={newRecName}
                  onChange={e => setNewRecName(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  placeholder="Amount (₹)"
                  type="number"
                  value={newRecAmount}
                  onChange={e => setNewRecAmount(e.target.value)}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  placeholder="Due day (1-31)"
                  type="number"
                  min={1}
                  max={31}
                  value={newRecDay}
                  onChange={e => setNewRecDay(e.target.value)}
                />
              </div>
              <Button size="sm" variant="secondary" onClick={addRecurringItem} className="w-full">
                <Plus className="h-3.5 w-3.5" />
                Add to Commitments
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Safety Cushion & Review */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              What minimum emergency cushion would you like to keep in reserve before your next payout?
            </p>
            <Input
              label="Emergency Reserve Target (₹)"
              type="number"
              prefixSymbol="₹"
              value={targetReserveRupees}
              onChange={e => setTargetReserveRupees(e.target.value)}
              helperText="Default is ₹500. We will warn you before your balance dips below this cushion."
            />
            <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>You're all set!</strong>
                <p className="mt-0.5 text-emerald-800">
                  We will calculate your safe daily spending limit and survival forecast as soon as you finish.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {step > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((step - 1) as any)}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button size="sm" onClick={() => setStep((step + 1) as any)}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleFinish} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none">
              Start Tracking
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
