'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  AllowanceCycle,
  Category,
  ForecastResult,
  RecurringExpense,
  Transaction,
  UserProfile,
} from '@/types/finance';
import {
  ARYAN_CYCLE,
  ARYAN_PROFILE,
  ARYAN_RECURRING,
  ARYAN_TRANSACTIONS,
  DEFAULT_CATEGORIES,
} from './sampleData';
import { calculateForecast } from '@/lib/finance/forecast';
import { computeCycleDates, formatISODate } from '@/lib/finance/dates';

interface MoneyContextType {
  profile: UserProfile | null;
  cycle: AllowanceCycle | null;
  categories: Category[];
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  forecast: ForecastResult | null;
  isOnboarded: boolean;
  todayISO: string;
  setTodayISO: (dateISO: string) => void;
  completeOnboarding: (data: {
    allowanceAmountPaise: number;
    cycleDayOfMonth: number;
    openingBalancePaise: number;
    targetReservePaise: number;
    recurringExpenses: Array<{
      name: string;
      amountPaise: number;
      dueDayOfMonth: number;
      categoryId?: string | null;
    }>;
  }) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => void;
  editTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addRecurringExpense: (exp: {
    name: string;
    amountPaise: number;
    dueDayOfMonth: number;
    categoryId?: string | null;
    frequency?: 'monthly' | 'weekly';
  }) => void;
  togglePauseRecurringExpense: (id: string) => void;
  markRecurringExpensePaid: (id: string) => void;
  deleteRecurringExpense: (id: string) => void;
  resetToDemo: () => void;
  resetToCleanSlate: () => void;
}

const MoneyContext = createContext<MoneyContextType | undefined>(undefined);

const STORAGE_KEY = 'ai_money_tracker_state_v1';

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cycle, setCycle] = useState<AllowanceCycle | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  
  // Injected today reference date (default to current date YYYY-MM-DD or Oct 15, 2026 for demo consistency)
  const [todayISO, setTodayISO] = useState<string>('2026-10-15');

  // Load from localStorage or initialize with demo data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setProfile(parsed.profile);
        setCycle(parsed.cycle);
        setCategories(parsed.categories || DEFAULT_CATEGORIES);
        setTransactions(parsed.transactions || []);
        setRecurringExpenses(parsed.recurringExpenses || []);
        if (parsed.todayISO) setTodayISO(parsed.todayISO);
      } else {
        // Initialize with Aryan's realistic sample data by default for instant interactivity
        setProfile(ARYAN_PROFILE);
        setCycle(ARYAN_CYCLE);
        setCategories(DEFAULT_CATEGORIES);
        setTransactions(ARYAN_TRANSACTIONS);
        setRecurringExpenses(ARYAN_RECURRING);
      }
    } catch (e) {
      console.warn('Failed to load local storage state, using demo defaults', e);
      setProfile(ARYAN_PROFILE);
      setCycle(ARYAN_CYCLE);
      setCategories(DEFAULT_CATEGORIES);
      setTransactions(ARYAN_TRANSACTIONS);
      setRecurringExpenses(ARYAN_RECURRING);
    }
    setIsInitialized(true);
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          profile,
          cycle,
          categories,
          transactions,
          recurringExpenses,
          todayISO,
        })
      );
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [profile, cycle, categories, transactions, recurringExpenses, todayISO, isInitialized]);

  // Derived: Is the user onboarded?
  const isOnboarded = useMemo(() => {
    return Boolean(profile && cycle && cycle.isActive);
  }, [profile, cycle]);

  // Derived: Real-time deterministic financial forecast
  const forecast = useMemo(() => {
    if (!cycle || !isOnboarded) return null;
    return calculateForecast({
      todayISO,
      cycle,
      transactions,
      recurringExpenses,
    });
  }, [todayISO, cycle, transactions, recurringExpenses, isOnboarded]);

  // Handler: Complete Onboarding
  const completeOnboarding = useCallback(
    (data: {
      allowanceAmountPaise: number;
      cycleDayOfMonth: number;
      openingBalancePaise: number;
      targetReservePaise: number;
      recurringExpenses: Array<{
        name: string;
        amountPaise: number;
        dueDayOfMonth: number;
        categoryId?: string | null;
      }>;
    }) => {
      const userId = 'user-me';
      const { currentCycleStart, nextPayoutDate } = computeCycleDates(todayISO, data.cycleDayOfMonth);

      const newProfile: UserProfile = {
        id: userId,
        displayName: 'Student',
        currencyCode: 'INR',
        currencySymbol: '₹',
        targetReservePaise: data.targetReservePaise,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newCycle: AllowanceCycle = {
        id: `cycle-${Date.now()}`,
        userId,
        allowanceAmountPaise: data.allowanceAmountPaise,
        cycleDayOfMonth: data.cycleDayOfMonth,
        currentCycleStart,
        nextPayoutDate,
        openingBalancePaise: data.openingBalancePaise,
        targetReservePaise: data.targetReservePaise,
        isActive: true,
      };

      const newRecurring: RecurringExpense[] = data.recurringExpenses.map((exp, idx) => ({
        id: `rec-${Date.now()}-${idx}`,
        userId,
        categoryId: exp.categoryId || null,
        name: exp.name,
        amountPaise: exp.amountPaise,
        frequency: 'monthly',
        dueDayOfMonth: exp.dueDayOfMonth,
        nextDueDate: nextPayoutDate,
        isPaused: false,
        lastPaidDate: null,
      }));

      setProfile(newProfile);
      setCycle(newCycle);
      setRecurringExpenses(newRecurring);
      setTransactions([]); // Start with fresh clean ledger
    },
    [todayISO]
  );

  // Handler: Add Transaction
  const addTransaction = useCallback(
    (tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => {
      const newTx: Transaction = {
        ...tx,
        id: `tx-${Date.now()}`,
        userId: profile?.id || 'user-me',
        createdAt: new Date().toISOString(),
      };
      setTransactions(prev => [newTx, ...prev]);
    },
    [profile]
  );

  // Handler: Edit Transaction
  const editTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Handler: Delete Transaction
  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  // Handler: Add Recurring Expense
  const addRecurringExpense = useCallback(
    (exp: {
      name: string;
      amountPaise: number;
      dueDayOfMonth: number;
      categoryId?: string | null;
      frequency?: 'monthly' | 'weekly';
    }) => {
      const newRec: RecurringExpense = {
        id: `rec-${Date.now()}`,
        userId: profile?.id || 'user-me',
        categoryId: exp.categoryId || null,
        name: exp.name,
        amountPaise: exp.amountPaise,
        frequency: exp.frequency || 'monthly',
        dueDayOfMonth: exp.dueDayOfMonth,
        nextDueDate: cycle?.nextPayoutDate || todayISO,
        isPaused: false,
        lastPaidDate: null,
      };
      setRecurringExpenses(prev => [...prev, newRec]);
    },
    [profile, cycle, todayISO]
  );

  // Handler: Toggle Pause Recurring Expense
  const togglePauseRecurringExpense = useCallback((id: string) => {
    setRecurringExpenses(prev =>
      prev.map(r => (r.id === id ? { ...r, isPaused: !r.isPaused } : r))
    );
  }, []);

  // Handler: Mark Recurring Expense as Paid (Deduplication!)
  const markRecurringExpensePaid = useCallback(
    (id: string) => {
      const target = recurringExpenses.find(r => r.id === id);
      if (!target) return;

      // 1. Mark lastPaidDate on recurring expense
      setRecurringExpenses(prev =>
        prev.map(r => (r.id === id ? { ...r, lastPaidDate: todayISO } : r))
      );

      // 2. Add ledger transaction linked to this recurring bill
      const newTx: Transaction = {
        id: `tx-bill-${Date.now()}`,
        userId: profile?.id || 'user-me',
        categoryId: target.categoryId,
        type: 'expense',
        amountPaise: target.amountPaise,
        description: `${target.name} (Bill Payment)`,
        transactionDate: todayISO,
        createdAt: new Date().toISOString(),
        recurringExpenseId: target.id,
      };
      setTransactions(prev => [newTx, ...prev]);
    },
    [recurringExpenses, todayISO, profile]
  );

  // Handler: Delete Recurring Expense
  const deleteRecurringExpense = useCallback((id: string) => {
    setRecurringExpenses(prev => prev.filter(r => r.id !== id));
  }, []);

  // Handler: Reset to Demo Persona (Aryan)
  const resetToDemo = useCallback(() => {
    setProfile(ARYAN_PROFILE);
    setCycle(ARYAN_CYCLE);
    setCategories(DEFAULT_CATEGORIES);
    setTransactions(ARYAN_TRANSACTIONS);
    setRecurringExpenses(ARYAN_RECURRING);
    setTodayISO('2026-10-15');
  }, []);

  // Handler: Reset to Clean Slate (Triggers Onboarding)
  const resetToCleanSlate = useCallback(() => {
    setProfile(null);
    setCycle(null);
    setTransactions([]);
    setRecurringExpenses([]);
    setCategories(DEFAULT_CATEGORIES);
    setTodayISO(formatISODate(new Date()));
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <MoneyContext.Provider
      value={{
        profile,
        cycle,
        categories,
        transactions,
        recurringExpenses,
        forecast,
        isOnboarded,
        todayISO,
        setTodayISO,
        completeOnboarding,
        addTransaction,
        editTransaction,
        deleteTransaction,
        addRecurringExpense,
        togglePauseRecurringExpense,
        markRecurringExpensePaid,
        deleteRecurringExpense,
        resetToDemo,
        resetToCleanSlate,
      }}
    >
      {children}
    </MoneyContext.Provider>
  );
}

export function useMoney() {
  const context = useContext(MoneyContext);
  if (!context) {
    throw new Error('useMoney must be used within a MoneyProvider');
  }
  return context;
}
