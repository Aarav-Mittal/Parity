import React from 'react';
import { ActionProposal } from '@/types/chat';
import { Category } from '@/types/finance';
import { formatRupees } from '@/lib/finance/currency';
import { Button } from '@/components/ui/Button';
import { Check, X, ArrowRight, AlertCircle, ShoppingBag, ArrowUpRight, ArrowDownLeft, RotateCcw } from 'lucide-react';

interface ActionCardProps {
  proposal: ActionProposal;
  categories: Category[];
  onConfirm: (proposal: ActionProposal) => void;
  onCancel: (proposal: ActionProposal) => void;
}

export function ActionCard({ proposal, categories, onConfirm, onCancel }: ActionCardProps) {
  const getCategoryName = (catId?: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : 'Miscellaneous';
  };

  if (proposal.type === 'create_transaction') {
    const { type, amountPaise, description, categoryId, isOneOff, isRefund } = proposal.payload;
    const catName = getCategoryName(categoryId);

    return (
      <div className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={`p-1.5 rounded-lg ${
              isRefund
                ? 'bg-blue-50 text-blue-700'
                : type === 'income'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}>
              {type === 'income' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </span>
            <div>
              <span className="font-semibold text-slate-900 text-sm">
                {type === 'income' ? (isRefund ? 'Refund / Cashback' : 'Income') : 'Expense'}
              </span>
              <span className="text-slate-400 text-[11px] block">{catName}</span>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-base font-bold ${
              type === 'income' ? 'text-emerald-600' : 'text-slate-900'
            }`}>
              {type === 'income' ? '+' : '-'}{formatRupees(amountPaise)}
            </span>
          </div>
        </div>

        <div className="py-2.5 space-y-1">
          <div className="flex justify-between text-slate-600">
            <span className="text-slate-400">Description:</span>
            <span className="font-medium text-slate-800">{description}</span>
          </div>
          {isOneOff && (
            <div className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 px-2 py-0.5 text-[10px] font-medium mt-1">
              <span>One-off capital purchase (won't inflate daily velocity)</span>
            </div>
          )}
        </div>

        {proposal.status === 'pending' ? (
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="flex-1 py-1.5 text-xs font-semibold gap-1.5"
              onClick={() => onConfirm(proposal)}
            >
              <Check className="h-3.5 w-3.5" />
              Confirm & Log
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => onCancel(proposal)}
            >
              Cancel
            </Button>
          </div>
        ) : proposal.status === 'confirmed' ? (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-emerald-700 font-medium">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Logged to ledger
            </span>
            <span className="text-[10px] text-slate-400">Updated</span>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-slate-400 font-medium">
            <X className="h-3.5 w-3.5" /> Cancelled
          </div>
        )}
      </div>
    );
  }

  if (proposal.type === 'update_transaction') {
    const { originalAmountPaise, newAmountPaise, originalDescription, newDescription } = proposal.payload;

    return (
      <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-amber-100 font-semibold text-amber-900">
          <RotateCcw className="h-4 w-4 text-amber-600" />
          <span>Correction Proposal</span>
        </div>

        <div className="py-2.5 space-y-1.5 text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Transaction:</span>
            <span className="font-medium text-slate-800">{originalDescription}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Amount Change:</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span className="line-through text-slate-400">{formatRupees(originalAmountPaise)}</span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="text-emerald-600">{newAmountPaise ? formatRupees(newAmountPaise) : 'N/A'}</span>
            </div>
          </div>

          {newDescription && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">New Title:</span>
              <span className="font-medium text-slate-800">{newDescription}</span>
            </div>
          )}
        </div>

        {proposal.status === 'pending' ? (
          <div className="flex gap-2 pt-2 border-t border-amber-100">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="flex-1 py-1.5 text-xs font-semibold gap-1.5 bg-amber-600 hover:bg-amber-700"
              onClick={() => onConfirm(proposal)}
            >
              <Check className="h-3.5 w-3.5" />
              Apply Correction
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => onCancel(proposal)}
            >
              Dismiss
            </Button>
          </div>
        ) : proposal.status === 'confirmed' ? (
          <div className="pt-2 border-t border-amber-100 flex items-center gap-1.5 text-emerald-700 font-medium">
            <Check className="h-3.5 w-3.5" /> Correction applied
          </div>
        ) : (
          <div className="pt-2 border-t border-amber-100 flex items-center gap-1 text-slate-400 font-medium">
            <X className="h-3.5 w-3.5" /> Dismissed
          </div>
        )}
      </div>
    );
  }

  if (proposal.type === 'delete_transaction') {
    const { description, amountPaise } = proposal.payload;

    return (
      <div className="mt-2.5 rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-sm text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-rose-100 font-semibold text-rose-900">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <span>Confirm Undo / Deletion</span>
        </div>

        <div className="py-2.5 space-y-1 text-slate-700">
          <p className="text-slate-600">
            Are you sure you want to remove <span className="font-semibold text-slate-900">"{description}"</span> ({formatRupees(amountPaise)}) from your ledger?
          </p>
        </div>

        {proposal.status === 'pending' ? (
          <div className="flex gap-2 pt-2 border-t border-rose-100">
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="flex-1 py-1.5 text-xs font-semibold gap-1.5"
              onClick={() => onConfirm(proposal)}
            >
              <Check className="h-3.5 w-3.5" />
              Delete Transaction
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => onCancel(proposal)}
            >
              Keep
            </Button>
          </div>
        ) : proposal.status === 'confirmed' ? (
          <div className="pt-2 border-t border-rose-100 flex items-center gap-1.5 text-rose-700 font-medium">
            <Check className="h-3.5 w-3.5" /> Transaction deleted
          </div>
        ) : (
          <div className="pt-2 border-t border-rose-100 flex items-center gap-1 text-slate-400 font-medium">
            <X className="h-3.5 w-3.5" /> Kept
          </div>
        )}
      </div>
    );
  }

  return null;
}
