'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useMoney } from '@/lib/store/MoneyContext';
import { formatPaiseToINR, rupeesToPaise } from '@/lib/finance/currency';
import { isRecurringExpensePaidInCycle } from '@/lib/finance/forecast';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Calendar, CheckCircle2, Clock, Plus, Pause, Play, Trash2 } from 'lucide-react';

export function UpcomingBillsCard() {
  const {
    recurringExpenses,
    cycle,
    markRecurringExpensePaid,
    togglePauseRecurringExpense,
    deleteRecurringExpense,
    addRecurringExpense,
    categories,
  } = useMoney();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('10');
  const [billCategory, setBillCategory] = useState(categories[0]?.id || '');

  const cycleStart = cycle?.currentCycleStart || '2026-10-01';

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billName || !billAmount) return;

    addRecurringExpense({
      name: billName,
      amountPaise: rupeesToPaise(parseFloat(billAmount) || 0),
      dueDayOfMonth: parseInt(billDueDay, 10) || 1,
      categoryId: billCategory || null,
    });

    setBillName('');
    setBillAmount('');
    setBillDueDay('10');
    setIsAddModalOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <CardTitle>Upcoming Fixed Obligations</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Bill
          </Button>
        </CardHeader>

        {recurringExpenses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            No recurring bills added yet. Add predictable expenses like room rent, Wi-Fi, or phone recharge to protect your budget.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recurringExpenses.map(rec => {
              const isPaid = isRecurringExpensePaidInCycle(rec, cycleStart);
              const cat = categories.find(c => c.id === rec.categoryId);

              return (
                <div
                  key={rec.id}
                  className={`flex flex-wrap items-center justify-between py-3.5 first:pt-0 last:pb-0 gap-2 ${
                    rec.isPaused ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon
                      iconName={cat?.icon}
                      colorHex={cat?.colorHex}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{rec.name}</span>
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" /> Paid this cycle
                          </span>
                        )}
                        {rec.isPaused && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 font-medium">
                            Paused
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        Due day {rec.dueDayOfMonth} of month
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">
                      {formatPaiseToINR(rec.amountPaise)}
                    </span>

                    {!isPaid && !rec.isPaused && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => markRecurringExpensePaid(rec.id)}
                        className="text-xs"
                      >
                        Mark as Paid
                      </Button>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => togglePauseRecurringExpense(rec.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                        title={rec.isPaused ? 'Resume bill' : 'Pause bill'}
                      >
                        {rec.isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => deleteRecurringExpense(rec.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete bill"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add Recurring Bill Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Recurring Obligation"
        description="Schedule a predictable future payment (e.g. rent, Wi-Fi, Spotify)."
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Obligation Name"
            placeholder="Hostel Wi-Fi, Room Rent..."
            value={billName}
            onChange={e => setBillName(e.target.value)}
            required
          />
          <Input
            label="Amount (₹)"
            type="number"
            prefixSymbol="₹"
            placeholder="499"
            value={billAmount}
            onChange={e => setBillAmount(e.target.value)}
            required
          />
          <Input
            label="Due Day of Month (1 - 31)"
            type="number"
            min={1}
            max={31}
            value={billDueDay}
            onChange={e => setBillDueDay(e.target.value)}
            required
          />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Category
            </label>
            <select
              value={billCategory}
              onChange={e => setBillCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Obligation
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
