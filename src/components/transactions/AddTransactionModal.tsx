'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useMoney } from '@/lib/store/MoneyContext';
import { rupeesToPaise } from '@/lib/finance/currency';
import { TransactionType } from '@/types/finance';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
}

export function AddTransactionModal({
  isOpen,
  onClose,
  defaultType = 'expense',
}: AddTransactionModalProps) {
  const { addTransaction, categories, todayISO } = useMoney();

  const [type, setType] = useState<TransactionType>(defaultType);
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [date, setDate] = useState(todayISO);
  const [isOneOff, setIsOneOff] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountRupees || !description) return;

    const amountPaise = rupeesToPaise(parseFloat(amountRupees) || 0);

    addTransaction({
      type,
      amountPaise,
      description,
      categoryId: categoryId || null,
      transactionDate: date || todayISO,
      isOneOff: type === 'expense' ? isOneOff : false,
    });

    setAmountRupees('');
    setDescription('');
    setIsOneOff(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'income' ? 'Record Income / Top-up / Refund' : 'Record Expense'}
      description="Add an entry directly to your financial ledger."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type Tabs: Expense vs Income/Top-up/Refund */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`rounded-lg py-2 transition-colors cursor-pointer ${
              type === 'expense'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`rounded-lg py-2 transition-colors cursor-pointer ${
              type === 'income'
                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Income / Top-up / Refund
          </button>
        </div>

        {/* Amount */}
        <Input
          label="Amount (₹)"
          type="number"
          step="any"
          prefixSymbol="₹"
          placeholder="120"
          value={amountRupees}
          onChange={e => setAmountRupees(e.target.value)}
          required
          autoFocus
        />

        {/* Description */}
        <Input
          label="Description"
          placeholder={type === 'expense' ? 'Auto to campus, Canteen lunch...' : 'Monthly allowance top-up, canteen refund...'}
          value={description}
          onChange={e => setDescription(e.target.value)}
          required
        />

        {/* Category & Date Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Category
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-hidden"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-hidden"
            />
          </div>
        </div>

        {/* One-Off Purchase Checkbox (for expenses only) */}
        {type === 'expense' && (
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={isOneOff}
              onChange={e => setIsOneOff(e.target.checked)}
              className="mt-0.5 rounded text-slate-900 dark:text-slate-100 focus:ring-slate-900"
            />
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200">One-off / irregular purchase</span>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                Check this for infrequent expenses (e.g. semester textbooks, phone repair) so it doesn't falsely inflate your daily living burn rate.
              </p>
            </div>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            Save Transaction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
