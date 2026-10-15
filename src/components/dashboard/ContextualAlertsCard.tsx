'use client';

import React, { useState } from 'react';
import { useMoney } from '@/lib/store/MoneyContext';
import { evaluateContextualAlerts } from '@/lib/finance/alerts';
import { ContextualAlert } from '@/types/alerts';
import { Button } from '@/components/ui/Button';
import {
  AlertTriangle,
  Calendar,
  Flame,
  ShieldCheck,
  AlertCircle,
  X,
  ArrowRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface ContextualAlertsCardProps {
  onOpenChat?: (prefill?: string) => void;
  onScrollToBills?: () => void;
  onOpenSimulator?: () => void;
}

export function ContextualAlertsCard({
  onOpenChat,
  onScrollToBills,
  onOpenSimulator,
}: ContextualAlertsCardProps) {
  const { cycle, forecast, recurringExpenses, transactions, todayISO, markRecurringExpensePaid } = useMoney();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  if (!cycle || !forecast) return null;

  const allAlerts = evaluateContextualAlerts({
    todayISO,
    cycle,
    forecast,
    recurringExpenses,
    transactions,
  });

  const activeAlerts = allAlerts.filter(a => !dismissedIds.has(a.id));

  if (activeAlerts.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  };

  const getAlertIcon = (category: ContextualAlert['category'], severity: ContextualAlert['severity']) => {
    switch (category) {
      case 'deficit_runout':
        return <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />;
      case 'bill_due':
        return <Calendar className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />;
      case 'burn_rate':
        return <Flame className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />;
      case 'reserve_breach':
        return <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />;
      case 'safe_pace':
      default:
        return <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />;
    }
  };

  const getCardStyle = (severity: ContextualAlert['severity']) => {
    switch (severity) {
      case 'danger':
        return 'border-rose-200 bg-rose-50/70 text-rose-950';
      case 'warning':
        return 'border-amber-200 bg-amber-50/70 text-amber-950';
      case 'success':
        return 'border-emerald-200 bg-emerald-50/70 text-emerald-950';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50/70 text-blue-950';
    }
  };

  const handleAction = (alert: ContextualAlert) => {
    if (alert.category === 'bill_due' && alert.metadata?.billId) {
      // If user clicks "Mark Paid" on an approaching bill alert
      markRecurringExpensePaid(alert.metadata.billId);
      handleDismiss(alert.id);
    } else if (alert.actionType === 'open_chat') {
      onOpenChat?.(alert.category === 'burn_rate' ? 'How can I slow down my daily spend?' : 'Will my money last?');
    } else if (alert.actionType === 'view_bills') {
      onScrollToBills?.();
    } else if (alert.actionType === 'adjust_budget') {
      onOpenSimulator?.();
    }
  };

  return (
    <div className="space-y-2.5">
      {activeAlerts.map(alert => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-3.5 shadow-2xs transition-all ${getCardStyle(
            alert.severity
          )}`}
        >
          <div className="flex items-start gap-3">
            {getAlertIcon(alert.category, alert.severity)}
            <div>
              <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                {alert.title}
              </h4>
              <p className="mt-1 text-xs opacity-90 leading-relaxed max-w-2xl">
                {alert.message}
              </p>

              {alert.actionLabel && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction(alert)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <span>{alert.actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleDismiss(alert.id)}
            title="Dismiss alert"
            aria-label="Dismiss alert"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
