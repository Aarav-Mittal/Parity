import React from 'react';
import { SurvivalStatus } from '@/types/finance';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm font-medium';

  const variantClasses = {
    default: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    success: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    warning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    danger: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
    purple: 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </span>
  );
}

export function SurvivalBadge({ status }: { status: SurvivalStatus }) {
  const config = {
    safe: {
      variant: 'success' as const,
      dotClass: 'bg-emerald-500',
      label: 'On Track',
    },
    tight: {
      variant: 'warning' as const,
      dotClass: 'bg-amber-500',
      label: 'Budget Tight',
    },
    danger: {
      variant: 'danger' as const,
      dotClass: 'bg-rose-500',
      label: 'Shortfall Projected',
    },
  }[status];

  return (
    <Badge variant={config.variant} size="md">
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </Badge>
  );
}
