'use client';

import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Plus,
  CalendarDays,
  Sparkles,
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenAddExpense: () => void;
  onOpenChat: () => void;
  onNavigateToSection: (sectionId: string) => void;
}

export function MobileBottomNav({
  onOpenAddExpense,
  onOpenChat,
  onNavigateToSection,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 block sm:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.5)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-2 py-1 h-16">
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => onNavigateToSection('dashboard-top')}
          className="flex flex-col items-center justify-center w-14 h-full min-h-[44px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer"
          aria-label="Go to Dashboard"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] font-medium mt-1">Dashboard</span>
        </button>

        {/* Ledger */}
        <button
          type="button"
          onClick={() => onNavigateToSection('ledger-section')}
          className="flex flex-col items-center justify-center w-14 h-full min-h-[44px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer"
          aria-label="Go to Ledger"
        >
          <Receipt className="h-5 w-5" />
          <span className="text-[10px] font-medium mt-1">Ledger</span>
        </button>

        {/* Quick Log (+ button) centered pill */}
        <button
          type="button"
          onClick={onOpenAddExpense}
          className="relative -top-2 flex flex-col items-center justify-center h-12 w-12 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-900/30 dark:shadow-slate-100/20 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all hover:scale-105 cursor-pointer min-h-[44px] min-w-[44px]"
          aria-label="Quick Add Transaction"
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </button>

        {/* Bills */}
        <button
          type="button"
          onClick={() => onNavigateToSection('bills-section')}
          className="flex flex-col items-center justify-center w-14 h-full min-h-[44px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors cursor-pointer"
          aria-label="Go to Bills"
        >
          <CalendarDays className="h-5 w-5" />
          <span className="text-[10px] font-medium mt-1">Bills</span>
        </button>

        {/* AI Chat */}
        <button
          type="button"
          onClick={onOpenChat}
          className="flex flex-col items-center justify-center w-14 h-full min-h-[44px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px] font-semibold mt-1">AI Chat</span>
        </button>
      </div>
    </nav>
  );
}
