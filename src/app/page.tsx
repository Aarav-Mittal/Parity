'use client';

import React, { useState } from 'react';
import { useMoney } from '@/lib/store/MoneyContext';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { UpcomingBillsCard } from '@/components/dashboard/UpcomingBillsCard';
import { ContextualAlertsCard } from '@/components/dashboard/ContextualAlertsCard';
import { CategoryBreakdownCard } from '@/components/dashboard/CategoryBreakdownCard';
import { TransactionLedger } from '@/components/transactions/TransactionLedger';
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { TransactionType } from '@/types/finance';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  Sparkles,
  RotateCcw,
  UserCheck,
  CalendarDays,
  ShieldAlert,
} from 'lucide-react';

export default function Home() {
  const {
    isOnboarded,
    profile,
    cycle,
    todayISO,
    setTodayISO,
    resetToDemo,
    resetToCleanSlate,
  } = useMoney();

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
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

  const openAddExpense = () => {
    setAddTxDefaultType('expense');
    setIsAddTxOpen(true);
  };

  const openAddIncome = () => {
    setAddTxDefaultType('income');
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-slate-900 block leading-tight">
                Money Survival
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Student Budgeting & Run-Out Forecast
              </span>
            </div>
          </div>

          {/* Dev / Testing Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span>Simulated Date:</span>
              <input
                type="date"
                value={todayISO}
                onChange={e => setTodayISO(e.target.value)}
                className="bg-transparent font-mono text-xs text-slate-900 font-semibold focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDemo}
                title="Reset to Aryan's sample student data"
                className="text-xs text-slate-600"
              >
                <UserCheck className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden md:inline">Demo Persona (Aryan)</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetToCleanSlate();
                  setIsOnboardingOpen(true);
                }}
                title="Start clean slate onboarding"
                className="text-xs text-slate-600"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span className="hidden md:inline">New Budget</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {!isOnboarded ? (
          /* Empty / Un-onboarded State */
          <div className="mx-auto max-w-lg py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg mb-6">
              <Wallet className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Will your money survive until your next allowance?
            </h1>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Designed specifically for college students managing a monthly allowance or stipend. Know your safe daily spend, account for room rent and Wi-Fi, and prevent end-of-month panic.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => setIsOnboardingOpen(true)}
                className="w-full sm:w-auto"
              >
                Set Up My Budget (1 Min)
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={resetToDemo}
                className="w-full sm:w-auto"
              >
                <UserCheck className="h-4 w-4" /> Load Aryan's Demo Profile
              </Button>
            </div>
          </div>
        ) : (
          /* Active Dashboard View */
          <div className="space-y-6">
            {/* Survival Dashboard Hero */}
            <DashboardHero />

            {/* Contextual Real-time Alerts */}
            <ContextualAlertsCard
              onOpenChat={handleOpenChatWithPrefill}
              onScrollToBills={handleScrollToBills}
            />

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
              <span className="text-xs font-semibold text-slate-600 pl-2">
                Quick Actions
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={openAddExpense}>
                  <Plus className="h-3.5 w-3.5" /> Log Expense
                </Button>
                <Button size="sm" variant="secondary" onClick={openAddIncome}>
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Record Income / Top-up
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsChatOpen(true)}
                  className="border-slate-300"
                >
                  <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                  Chat Assistant
                </Button>
              </div>
            </div>

            {/* Two-Column Layout: Ledger & Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2">
                <TransactionLedger onOpenAddModal={openAddExpense} />
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

      {/* Floating Chat Trigger Button */}
      {isOnboarded && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          title="Open Conversational AI Assistant (Ctrl+K)"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl hover:bg-slate-800 transition-all hover:scale-105 cursor-pointer border border-slate-700/50"
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Ask AI / Quick Log</span>
          <span className="hidden sm:inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">Ctrl+K</span>
        </button>
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
    </div>
  );
}
