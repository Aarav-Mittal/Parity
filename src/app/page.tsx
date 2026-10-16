'use client';

import React, { useState } from 'react';
import { useMoney } from '@/lib/store/MoneyContext';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { UpcomingBillsCard } from '@/components/dashboard/UpcomingBillsCard';
import { ContextualAlertsCard } from '@/components/dashboard/ContextualAlertsCard';
import { CategoryBreakdownCard } from '@/components/dashboard/CategoryBreakdownCard';
import { WhatIfSimulatorModal } from '@/components/dashboard/WhatIfSimulatorModal';
import { TransactionLedger } from '@/components/transactions/TransactionLedger';
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Button } from '@/components/ui/Button';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { TransactionType } from '@/types/finance';
import {
  Wallet,
  Plus,
  Sparkles,
  RotateCcw,
  UserCheck,
  CalendarDays,
  Calculator,
  ArrowLeft,
} from 'lucide-react';

export default function Home() {
  const {
    isOnboarded,
    isInitialized,
    isDemoMode,
    hasUserBudget,
    todayISO,
    setTodayISO,
    switchToDemo,
    switchToUserBudget,
    resetToCleanSlate,
  } = useMoney();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [addTxDefaultType, setAddTxDefaultType] = useState<TransactionType>('expense');
  const [chatPrefill, setChatPrefill] = useState<string | undefined>(undefined);

  // Global keyboard shortcut: Ctrl+K or Cmd+K toggles chat
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsChatOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openAddTransaction = (type: TransactionType = 'expense') => {
    setAddTxDefaultType(type);
    setIsAddTxOpen(true);
  };

  const handleOpenChatWithPrefill = (prefill?: string) => {
    setChatPrefill(prefill);
    setIsChatOpen(true);
  };

  const handleScrollToBills = () => {
    const el = document.getElementById('bills-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavigateToSection = (sectionId: string) => {
    if (sectionId === 'dashboard-top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!isInitialized) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 pb-28 sm:pb-16">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 block leading-tight">
                Parity
              </span>
              <span className="hidden sm:block text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                Student Budgeting & Run-Out Forecast
              </span>
            </div>
          </div>

          {/* Dev / Testing Controls & Theme Toggle */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span>Simulated Date:</span>
              <input
                type="date"
                value={todayISO}
                onChange={e => setTodayISO(e.target.value)}
                className="bg-transparent font-mono text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1">
              {isDemoMode && hasUserBudget ? (
                /* When in Demo mode, show quick button to return to My Budget */
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={switchToUserBudget}
                  title="Return to your personal ledger"
                  className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>My Budget</span>
                </Button>
              ) : (
                /* When in User mode, show option to inspect Demo */
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={switchToDemo}
                  title="View Aryan's sample student data"
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  <UserCheck className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="hidden md:inline">Demo Persona (Aryan)</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetToCleanSlate();
                  setIsOnboardingOpen(true);
                }}
                title="Start clean slate onboarding"
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden md:inline">New Budget</span>
              </Button>
            </div>

            {/* Dark / Light Mode Switcher */}
            <div className="ml-1 pl-2 border-l border-slate-200 dark:border-slate-800">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {!isOnboarded ? (
          /* Empty / Un-onboarded Landing Decision State */
          <div className="mx-auto max-w-lg py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-lg mb-6 ring-1 ring-slate-800 dark:ring-slate-700">
              <Wallet className="h-8 w-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Will your money survive until your next allowance?
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Designed specifically for college students managing a monthly allowance or stipend. Know your safe daily spend, account for room rent and Wi-Fi, and prevent end-of-month panic.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => setIsOnboardingOpen(true)}
                className="w-full sm:w-auto shadow-sm"
              >
                Set Up My Budget (1 Min)
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={switchToDemo}
                className="w-full sm:w-auto dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <UserCheck className="h-4 w-4" /> Load Aryan's Demo Profile
              </Button>
            </div>
          </div>
        ) : (
          /* Active Dashboard View */
          <div className="space-y-6">
            {/* Demo Mode Notice Banner (If user is viewing Aryan's profile) */}
            {isDemoMode && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 p-3.5 text-xs text-indigo-950 dark:text-indigo-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    Viewing <strong>Aryan's Sample Profile</strong> (₹8,000 allowance).
                    {hasUserBudget ? ' Your personal ledger is safely saved.' : ''}
                  </span>
                </div>
                {hasUserBudget ? (
                  <Button
                    size="sm"
                    onClick={switchToUserBudget}
                    className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 py-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Return to My Budget
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setIsOnboardingOpen(true)}
                    className="text-xs gap-1.5 py-1"
                  >
                    Set Up My Own Budget
                  </Button>
                )}
              </div>
            )}

            {/* Survival Dashboard Hero */}
            <div id="dashboard-top">
              <DashboardHero />
            </div>

            {/* Contextual Real-time Alerts */}
            <ContextualAlertsCard
              onOpenChat={handleOpenChatWithPrefill}
              onScrollToBills={handleScrollToBills}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
            />

            {/* Quick Actions Bar - Consolidated Single Add Transaction Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs transition-colors">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 pl-2">
                Quick Actions
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => openAddTransaction('expense')} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Transaction
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsSimulatorOpen(true)}
                  className="border-slate-300 dark:border-slate-700 dark:text-slate-300"
                >
                  <Calculator className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  What-If Simulator
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsChatOpen(true)}
                  className="border-slate-300 dark:border-slate-700 dark:text-slate-300"
                >
                  <Sparkles className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  Chat Assistant
                </Button>
              </div>
            </div>

            {/* Two-Column Layout: Ledger & Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div id="ledger-section" className="lg:col-span-2">
                <TransactionLedger />
              </div>
              <div className="lg:col-span-1 space-y-6">
                <CategoryBreakdownCard />
                <div id="bills-section">
                  <UpcomingBillsCard />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Chat Trigger Button (Desktop Only) */}
      {isOnboarded && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          title="Open Conversational AI Assistant (Ctrl+K)"
          aria-label="Open Conversational AI Assistant"
          className="hidden sm:flex fixed bottom-5 right-5 z-40 items-center gap-2 rounded-full bg-slate-900 dark:bg-emerald-600 px-4 py-3 text-xs font-semibold text-white shadow-xl hover:bg-slate-800 dark:hover:bg-emerald-500 transition-all hover:scale-105 cursor-pointer border border-slate-700/50 dark:border-emerald-500/50"
        >
          <Sparkles className="h-4 w-4 text-emerald-400 dark:text-white" />
          <span>Ask AI / Quick Log</span>
          <span className="inline-block rounded bg-slate-800 dark:bg-emerald-700 px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-emerald-100">
            Ctrl+K
          </span>
        </button>
      )}

      {/* Mobile Bottom Navigation Dock (Phones Only) */}
      {isOnboarded && (
        <MobileBottomNav
          onOpenAddExpense={() => openAddTransaction('expense')}
          onOpenChat={() => setIsChatOpen(true)}
          onNavigateToSection={handleNavigateToSection}
        />
      )}

      {/* Modals & Drawers */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        defaultType={addTxDefaultType}
      />

      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatPrefill(undefined);
        }}
        initialPrompt={chatPrefill}
      />

      <WhatIfSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </div>
  );
}
