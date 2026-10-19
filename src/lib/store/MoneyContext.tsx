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
import { DEFAULT_CATEGORIES } from './sampleData';
import { calculateForecast } from '@/lib/finance/forecast';
import { computeCycleDates, formatISODate } from '@/lib/finance/dates';
import { checkRolloverStatus, executeCycleRollover, RolloverPreview } from '@/lib/finance/rollover';

interface MoneyContextType {
  profile: UserProfile | null;
  cycle: AllowanceCycle | null;
  categories: Category[];
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  forecast: ForecastResult | null;
  isOnboarded: boolean;
  isInitialized: boolean;
  isDemoMode: boolean;
  hasUserBudget: boolean;
  todayISO: string;
  setTodayISO: (dateISO: string) => void;
  resetDateToToday: () => void;
  rolloverStatus: RolloverPreview | null;
  rolloverCycle: (newAllowancePaise?: number) => void;
  dismissRolloverForToday: () => void;
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
  switchToDemo?: () => void;
  switchToUserBudget?: () => void;
  resetToDemo?: () => void;
  resetToCleanSlate: () => void;
}

const MoneyContext = createContext<MoneyContextType | undefined>(undefined);

const STORAGE_ACTIVE_KEY = 'ai_money_tracker_state_v2';
const STORAGE_USER_KEY = 'parity_user_budget_v2';

export function MoneyProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [hasUserBudget, setHasUserBudget] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cycle, setCycle] = useState<AllowanceCycle | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  
  // Injected today reference date (defaults to sample date during SSR, initialized to real device date in client useEffect)
  const [todayISO, setTodayISO] = useState<string>('2026-10-15');
  const [dismissedRolloverDate, setDismissedRolloverDate] = useState<string | null>(null);

  // Load from localStorage or start clean slate
  useEffect(() => {
    try {
      const realToday = formatISODate(new Date());
      const savedUser = localStorage.getItem(STORAGE_USER_KEY);
      const savedActive = localStorage.getItem(STORAGE_ACTIVE_KEY);

      if (savedUser) {
        setHasUserBudget(true);
      }

      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        const isLegacyDemo = Boolean(
          parsed.isDemoMode ||
          parsed.profile?.id === 'usr-aryan' ||
          parsed.profile?.id === 'aryan-123'
        );

        if (isLegacyDemo) {
          // Cleanly purge old Aryan demo profile from client storage
          localStorage.removeItem(STORAGE_ACTIVE_KEY);
          localStorage.removeItem(STORAGE_USER_KEY);
          setProfile(null);
          setCycle(null);
          setCategories(DEFAULT_CATEGORIES);
          setTransactions([]);
          setRecurringExpenses([]);
          setTodayISO(realToday);
          setHasUserBudget(false);
          setIsDemoMode(false);
        } else {
          setProfile(parsed.profile);
          setCycle(parsed.cycle);
          setCategories(parsed.categories || DEFAULT_CATEGORIES);
          setTransactions(parsed.transactions || []);
          setRecurringExpenses(parsed.recurringExpenses || []);
          setTodayISO(realToday);
          setHasUserBudget(true);
          setIsDemoMode(false);
        }
      } else {
        // Clean slate by default - students land on onboarding setup
        setProfile(null);
        setCycle(null);
        setCategories(DEFAULT_CATEGORIES);
        setTransactions([]);
        setRecurringExpenses([]);
        setTodayISO(realToday);
        setIsDemoMode(false);
      }
    } catch (e) {
      console.warn('Failed to load local storage state', e);
      setProfile(null);
      setCycle(null);
      setCategories(DEFAULT_CATEGORIES);
      setTransactions([]);
      setRecurringExpenses([]);
      setTodayISO(formatISODate(new Date()));
      setIsDemoMode(false);
    }
    setIsInitialized(true);
  }, []);

  // Save active state to localStorage whenever it changes
  useEffect(() => {
    if (!isInitialized) return;
    try {
      const stateObj = {
        profile,
        cycle,
        categories,
        transactions,
        recurringExpenses,
        todayISO,
        isDemoMode,
      };

      localStorage.setItem(STORAGE_ACTIVE_KEY, JSON.stringify(stateObj));

      // If user is editing their own budget (not demo mode), also save to persistent user key
      if (!isDemoMode && profile && profile.id !== 'usr-aryan') {
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(stateObj));
        setHasUserBudget(true);
      }
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [profile, cycle, categories, transactions, recurringExpenses, todayISO, isDemoMode, isInitialized]);

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

  // Derived: Check if a cycle rollover is due
  const rolloverStatus = useMemo(() => {
    if (isDemoMode || !cycle || !isOnboarded) return null;
    const status = checkRolloverStatus(todayISO, cycle);
    if (!status || !status.isDue) return null;
    if (dismissedRolloverDate === todayISO) return null;
    return status;
  }, [todayISO, cycle, isOnboarded, isDemoMode, dismissedRolloverDate]);

  const dismissRolloverForToday = useCallback(() => {
    setDismissedRolloverDate(todayISO);
  }, [todayISO]);

  const resetDateToToday = useCallback(() => {
    const targetDate = formatISODate(new Date());
    setTodayISO(targetDate);
    setDismissedRolloverDate(null);

    // 1. Purge any simulated future rollover transactions
    setTransactions(prev =>
      prev.filter(tx => !(tx.rawInput === 'cycle-rollover' && tx.transactionDate > targetDate))
    );

    // 2. Synchronize cycle back to targetDate active cycle dates
    setCycle(prev => {
      if (!prev) return null;
      const { currentCycleStart, nextPayoutDate } = computeCycleDates(targetDate, prev.cycleDayOfMonth);
      return {
        ...prev,
        currentCycleStart,
        nextPayoutDate,
      };
    });
  }, []);

  const handleSetTodayISO = useCallback((dateISO: string) => {
    setTodayISO(dateISO);

    // If navigating to before the active cycle start, automatically align cycle dates to that period
    setCycle(prev => {
      if (!prev) return null;
      if (dateISO < prev.currentCycleStart) {
        const { currentCycleStart, nextPayoutDate } = computeCycleDates(dateISO, prev.cycleDayOfMonth);
        return {
          ...prev,
          currentCycleStart,
          nextPayoutDate,
        };
      }
      return prev;
    });
  }, []);

  const rolloverCycle = useCallback(
    (newAllowancePaise?: number) => {
      if (!cycle) return;
      const incomeCategory = categories.find(
        c => c.name.toLowerCase().includes('income') || c.name.toLowerCase().includes('allowance')
      )?.id || null;

      const { updatedCycle, newAllowanceTransaction } = executeCycleRollover({
        currentCycle: cycle,
        todayISO,
        newAllowancePaise,
        incomeCategoryId: incomeCategory,
      });

      const fullTx: Transaction = {
        ...newAllowanceTransaction,
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        createdAt: new Date().toISOString(),
      };

      setCycle(updatedCycle);
      setTransactions(prev => [fullTx, ...prev]);
      setDismissedRolloverDate(null);
    },
    [cycle, todayISO, categories]
  );

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
      setIsDemoMode(false);
      setHasUserBudget(true);

      try {
        localStorage.setItem(
          STORAGE_USER_KEY,
          JSON.stringify({
            profile: newProfile,
            cycle: newCycle,
            categories,
            transactions: [],
            recurringExpenses: newRecurring,
            todayISO,
            isDemoMode: false,
          })
        );
      } catch (err) {
        console.error('Failed to store initial user budget', err);
      }
    },
    [todayISO, categories]
  );

  // Handler: Add Transaction
  const addTransaction = useCallback((tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => {
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: profile?.id || 'user-me',
      createdAt: new Date().toISOString(),
    };
    setTransactions(prev => [newTx, ...prev]);
  }, [profile]);

  // Handler: Edit Transaction
  const editTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions(prev =>
      prev.map(tx => (tx.id === id ? { ...tx, ...updates } : tx))
    );
  }, []);

  // Handler: Delete Transaction
  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(tx => tx.id !== id));
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
      if (!cycle) return;
      const { nextPayoutDate } = cycle;
      const newExp: RecurringExpense = {
        id: `rec-${Date.now()}`,
        userId: profile?.id || 'user-me',
        categoryId: exp.categoryId || null,
        name: exp.name,
        amountPaise: exp.amountPaise,
        frequency: exp.frequency || 'monthly',
        dueDayOfMonth: exp.dueDayOfMonth,
        nextDueDate: nextPayoutDate,
        isPaused: false,
        lastPaidDate: null,
      };
      setRecurringExpenses(prev => [...prev, newExp]);
    },
    [cycle, profile]
  );

  // Handler: Toggle Pause Recurring Expense
  const togglePauseRecurringExpense = useCallback((id: string) => {
    setRecurringExpenses(prev =>
      prev.map(r => (r.id === id ? { ...r, isPaused: !r.isPaused } : r))
    );
  }, []);

  // Handler: Mark Recurring Expense as Paid in current cycle
  const markRecurringExpensePaid = useCallback(
    (id: string) => {
      const targetBill = recurringExpenses.find(r => r.id === id);
      if (!targetBill) return;

      // 1. Update bill's lastPaidDate
      setRecurringExpenses(prev =>
        prev.map(r => (r.id === id ? { ...r, lastPaidDate: todayISO } : r))
      );

      // 2. Automatically log matching transaction in ledger
      const paidTx: Transaction = {
        id: `tx-bill-${Date.now()}`,
        userId: profile?.id || 'user-me',
        categoryId: targetBill.categoryId,
        recurringExpenseId: targetBill.id,
        type: 'expense',
        amountPaise: targetBill.amountPaise,
        description: targetBill.name,
        transactionDate: todayISO,
        createdAt: new Date().toISOString(),
        rawInput: `Bill payment for ${targetBill.name}`,
        isCorrection: false,
        isOneOff: false,
      };
      setTransactions(prev => [paidTx, ...prev]);
    },
    [recurringExpenses, profile, todayISO]
  );

  // Handler: Delete Recurring Expense
  const deleteRecurringExpense = useCallback((id: string) => {
    setRecurringExpenses(prev => prev.filter(r => r.id !== id));
  }, []);

  // Handler: Reset to Clean Slate (Starts New Budget)
  const resetToCleanSlate = useCallback(() => {
    setProfile(null);
    setCycle(null);
    setTransactions([]);
    setRecurringExpenses([]);
    setCategories(DEFAULT_CATEGORIES);
    setTodayISO(formatISODate(new Date()));
    setIsDemoMode(false);
    setHasUserBudget(false);
    localStorage.removeItem(STORAGE_ACTIVE_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
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
        isInitialized,
        isDemoMode,
        hasUserBudget,
        todayISO,
        setTodayISO: handleSetTodayISO,
        resetDateToToday,
        rolloverStatus,
        rolloverCycle,
        dismissRolloverForToday,
        completeOnboarding,
        addTransaction,
        editTransaction,
        deleteTransaction,
        addRecurringExpense,
        togglePauseRecurringExpense,
        markRecurringExpensePaid,
        deleteRecurringExpense,
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
