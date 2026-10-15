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
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {prefixSymbol && (
          <span className="pointer-events-none absolute left-3.5 text-sm font-semibold text-slate-400">
            {prefixSymbol}
          </span>
        )}
        <input
          id={inputId}
          className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50 disabled:text-slate-400 ${
            prefixSymbol ? 'pl-8' : ''
          } ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300'} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
