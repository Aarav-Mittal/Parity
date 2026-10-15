'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useMoney } from '@/lib/store/MoneyContext';
import { formatPaiseToINR, rupeesToPaise } from '@/lib/finance/currency';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { Transaction } from '@/types/finance';
import { Search, Filter, Trash2, Edit2, Plus, Sparkles, AlertCircle } from 'lucide-react';

export function TransactionLedger({ onOpenAddModal }: { onOpenAddModal: () => void }) {
  const { transactions, categories, deleteTransaction, editTransaction, todayISO } = useMoney();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || tx.categoryId === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [transactions, searchQuery, selectedCategory]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { [date: string]: Transaction[] } = {};
    for (const tx of filtered) {
      if (!groups[tx.transactionDate]) {
        groups[tx.transactionDate] = [];
      }
      groups[tx.transactionDate].push(tx);
    }
    // Sort dates descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const [editIsOneOff, setEditIsOneOff] = useState(false);

  const startEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditDesc(tx.description);
    setEditAmount((tx.amountPaise / 100).toString());
    setEditCategory(tx.categoryId || '');
    setEditIsOneOff(Boolean(tx.isOneOff));
  };

  const toggleOneOff = (tx: Transaction) => {
    editTransaction(tx.id, {
      isOneOff: !tx.isOneOff,
    });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editDesc || !editAmount) return;

    editTransaction(editingTx.id, {
      description: editDesc,
      amountPaise: rupeesToPaise(parseFloat(editAmount) || 0),
      categoryId: editCategory || null,
      isOneOff: editIsOneOff,
      isCorrection: true,
    });
    setEditingTx(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-col sm:flex-row items-start sm:items-center gap-3">
          <div>
            <CardTitle>Transaction Ledger</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified records of every rupee logged into your account
            </p>
          </div>
          <Button size="sm" onClick={onOpenAddModal}>
            <Plus className="h-3.5 w-3.5" /> Add Transaction
          </Button>
        </CardHeader>

        {/* Filters & Search */}
        <div className="mb-4 flex flex-col sm:flex-row items-center gap-2 pt-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs focus:border-slate-900 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transactions List */}
        {groupedByDate.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No transactions found. Record your first expense or stipend top-up to begin tracking.
          </div>
        ) : (
          <div className="space-y-5">
            {groupedByDate.map(([date, txList]) => {
              const isToday = date === todayISO;
              return (
                <div key={date}>
                  <div className="mb-2 text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <span>{date}</span>
                    {isToday && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-slate-50/50">
                    {txList.map(tx => {
                      const cat = categories.find(c => c.id === tx.categoryId);
                      const isExpense = tx.type === 'expense';
                      const isIncome = tx.type === 'income';
                      const isRefund = tx.type === 'refund';

                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 transition-colors hover:bg-slate-100/50"
                        >
                          <div className="flex items-center gap-3">
                            <CategoryIcon
                              iconName={cat?.icon}
                              colorHex={cat?.colorHex}
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-slate-900">
                                  {tx.description}
                                </span>
                                {isExpense && !tx.recurringExpenseId && (
                                  <button
                                    type="button"
                                    onClick={() => toggleOneOff(tx)}
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                                      tx.isOneOff
                                        ? 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
                                    }`}
                                    title={
                                      tx.isOneOff
                                        ? 'Marked as one-off purchase. Click to change to regular daily expense.'
                                        : 'Click to mark as one-off purchase'
                                    }
                                  >
                                    {tx.isOneOff ? 'One-off ✓' : '+ One-off'}
                                  </button>
                                )}
                                {tx.recurringExpenseId && (
                                  <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.2 text-[10px] font-medium">
                                    Bill
                                  </span>
                                )}
                                {tx.isCorrection && (
                                  <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.2 text-[10px] font-medium">
                                    Edited
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">
                                {cat?.name || 'Uncategorized'}
                                {tx.rawInput ? ` • "${tx.rawInput}"` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-bold ${
                                isExpense
                                  ? 'text-slate-900'
                                  : isIncome
                                  ? 'text-emerald-700'
                                  : 'text-blue-700'
                              }`}
                            >
                              {isExpense ? '- ' : '+ '}
                              {formatPaiseToINR(tx.amountPaise)}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEdit(tx)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                title="Edit transaction"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => deleteTransaction(tx.id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
                                title="Delete transaction"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      {editingTx && (
        <Modal
          isOpen={Boolean(editingTx)}
          onClose={() => setEditingTx(null)}
          title="Edit Transaction"
          description="Correct the description, amount, or category. Ledger balance and forecast will update immediately."
        >
          <form onSubmit={saveEdit} className="space-y-4">
            <Input
              label="Description"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              required
            />
            <Input
              label="Amount (₹)"
              type="number"
              prefixSymbol="₹"
              value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
              required
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Category
              </label>
              <select
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-hidden"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {editingTx.type === 'expense' && !editingTx.recurringExpenseId && (
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={editIsOneOff}
                  onChange={e => setEditIsOneOff(e.target.checked)}
                  className="mt-0.5 rounded text-slate-900 focus:ring-slate-900"
                />
                <div>
                  <span className="font-semibold text-slate-800">One-off / irregular purchase</span>
                  <p className="text-slate-500 mt-0.5">
                    Separates this transaction from your daily living burn rate so it doesn't inflate your projected daily expenses.
                  </p>
                </div>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setEditingTx(null)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
