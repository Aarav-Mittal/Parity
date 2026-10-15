import { AllowanceCycle, Category, RecurringExpense, Transaction, UserProfile } from '@/types/finance';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food & Chai', icon: 'Coffee', colorHex: '#F97316', isSystem: true },
  { id: 'cat-travel', name: 'Travel & Auto', icon: 'Bus', colorHex: '#06B6D4', isSystem: true },
  { id: 'cat-rent', name: 'Hostel & Rent', icon: 'Home', colorHex: '#6366F1', isSystem: true },
  { id: 'cat-wifi', name: 'Mobile & Wi-Fi', icon: 'Wifi', colorHex: '#3B82F6', isSystem: true },
  { id: 'cat-subs', name: 'Subscriptions', icon: 'PlayCircle', colorHex: '#EC4899', isSystem: true },
  { id: 'cat-shopping', name: 'Shopping & Books', icon: 'ShoppingBag', colorHex: '#10B981', isSystem: true },
  { id: 'cat-health', name: 'Health & Meds', icon: 'Heart', colorHex: '#EF4444', isSystem: true },
  { id: 'cat-misc', name: 'Miscellaneous', icon: 'MoreHorizontal', colorHex: '#64748B', isSystem: true },
];

export const ARYAN_PROFILE: UserProfile = {
  id: 'aryan-123',
  displayName: 'Aryan',
  currencyCode: 'INR',
  currencySymbol: '₹',
  targetReservePaise: 50000, // ₹500
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
};

export const ARYAN_CYCLE: AllowanceCycle = {
  id: 'cycle-oct-2026',
  userId: 'aryan-123',
  allowanceAmountPaise: 800000, // ₹8,000
  cycleDayOfMonth: 1,
  currentCycleStart: '2026-10-01',
  nextPayoutDate: '2026-11-01',
  openingBalancePaise: 800000,
  targetReservePaise: 50000,
  isActive: true,
};

export const ARYAN_RECURRING: RecurringExpense[] = [
  {
    id: 'rec-rent',
    userId: 'aryan-123',
    categoryId: 'cat-rent',
    name: 'Room Rent',
    amountPaise: 250000, // ₹2,500
    frequency: 'monthly',
    dueDayOfMonth: 5,
    nextDueDate: '2026-11-05',
    isPaused: false,
    lastPaidDate: '2026-10-05', // Paid this cycle
  },
  {
    id: 'rec-wifi',
    userId: 'aryan-123',
    categoryId: 'cat-wifi',
    name: 'Hostel Wi-Fi',
    amountPaise: 49900, // ₹499
    frequency: 'monthly',
    dueDayOfMonth: 10,
    nextDueDate: '2026-11-10',
    isPaused: false,
    lastPaidDate: '2026-10-10', // Paid this cycle
  },
  {
    id: 'rec-recharge',
    userId: 'aryan-123',
    categoryId: 'cat-wifi',
    name: 'Mobile Recharge',
    amountPaise: 29900, // ₹299
    frequency: 'monthly',
    dueDayOfMonth: 20,
    nextDueDate: '2026-10-20',
    isPaused: false,
    lastPaidDate: null, // Due upcoming!
  },
];

export const ARYAN_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    userId: 'aryan-123',
    categoryId: 'cat-rent',
    type: 'expense',
    amountPaise: 250000,
    description: 'Room Rent (October)',
    transactionDate: '2026-10-05',
    createdAt: '2026-10-05T10:00:00Z',
    recurringExpenseId: 'rec-rent',
  },
  {
    id: 'tx-2',
    userId: 'aryan-123',
    categoryId: 'cat-wifi',
    type: 'expense',
    amountPaise: 49900,
    description: 'Hostel Wi-Fi Bill',
    transactionDate: '2026-10-10',
    createdAt: '2026-10-10T11:00:00Z',
    recurringExpenseId: 'rec-wifi',
  },
  {
    id: 'tx-3',
    userId: 'aryan-123',
    categoryId: 'cat-travel',
    type: 'expense',
    amountPaise: 12000,
    description: 'Auto to North Campus',
    transactionDate: '2026-10-12',
    createdAt: '2026-10-12T09:30:00Z',
    rawInput: 'paid 120 for auto to campus',
  },
  {
    id: 'tx-4',
    userId: 'aryan-123',
    categoryId: 'cat-food',
    type: 'expense',
    amountPaise: 18000,
    description: 'Lunch at College Canteen',
    transactionDate: '2026-10-13',
    createdAt: '2026-10-13T13:15:00Z',
    rawInput: 'spent 180 on canteen lunch',
  },
  {
    id: 'tx-5',
    userId: 'aryan-123',
    categoryId: 'cat-shopping',
    type: 'expense',
    amountPaise: 25000,
    description: 'Photocopying & Notes',
    transactionDate: '2026-10-14',
    createdAt: '2026-10-14T15:45:00Z',
    rawInput: 'spent 250 on notes',
  },
  {
    id: 'tx-6',
    userId: 'aryan-123',
    categoryId: 'cat-food',
    type: 'expense',
    amountPaise: 25000,
    description: 'Chai & Snacks with friends',
    transactionDate: '2026-10-14',
    createdAt: '2026-10-14T18:00:00Z',
  },
];
