import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  prefixSymbol?: string;
}

export function Input({
  label,
  helperText,
  error,
  prefixSymbol,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefixSymbol && (
          <span className="pointer-events-none absolute left-3.5 text-sm font-semibold text-slate-400 dark:text-slate-500">
            {prefixSymbol}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-500 ${
            prefixSymbol ? 'pl-8' : ''
          } ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700'} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>}
      {!error && helperText && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}
    </div>
  );
}
