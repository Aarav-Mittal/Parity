import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed rounded-xl';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  }[size];

  const variantStyles = {
    primary:
      'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-xs border border-slate-900',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/80',
    danger:
      'bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 border border-rose-200',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200 hover:text-slate-900',
    outline:
      'bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border border-slate-300 shadow-xs',
  }[variant];

  return (
    <button
      className={`${base} ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
