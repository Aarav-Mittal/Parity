import React from 'react';
import { SurvivalStatus } from '@/types/finance';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm font-medium';

  const variantClasses = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-800 border-rose-200/80',
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
