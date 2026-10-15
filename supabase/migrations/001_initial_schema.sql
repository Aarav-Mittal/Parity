-- ==============================================================================
-- AI Money Tracker — Database Schema Migration
-- Migration: 001_initial_schema.sql
-- 
-- Educational Notes:
-- 1. All monetary values are BIGINT stored in paise (1 INR = 100 paise).
-- 2. Row Level Security (RLS) is enabled on all tables to ensure 100% tenant isolation.
-- 3. auth.uid() matches the Supabase JWT token of the authenticated user.
-- ==============================================================================

-- 1. User Profiles
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    currency_code TEXT NOT NULL DEFAULT 'INR',
    currency_symbol TEXT NOT NULL DEFAULT '₹',
    target_reserve_paise BIGINT NOT NULL DEFAULT 50000, -- ₹500 default cushion
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Allowance Cycles
CREATE TABLE IF NOT EXISTS public.allowance_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    allowance_amount_paise BIGINT NOT NULL CHECK (allowance_amount_paise >= 0),
    cycle_day_of_month INTEGER NOT NULL CHECK (cycle_day_of_month >= 1 AND cycle_day_of_month <= 31),
    current_cycle_start DATE NOT NULL,
    next_payout_date DATE NOT NULL,
    opening_balance_paise BIGINT NOT NULL,
    target_reserve_paise BIGINT NOT NULL DEFAULT 50000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Categories (System default + user custom)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Tag',
    color_hex TEXT NOT NULL DEFAULT '#64748B',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Recurring Expenses (Scheduled obligations)
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'weekly')),
    due_day_of_month INTEGER NOT NULL CHECK (due_day_of_month >= 1 AND due_day_of_month <= 31),
    next_due_date DATE NOT NULL,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    last_paid_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Transactions (The Immutable Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'refund')),
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    description TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_input TEXT,
    is_correction BOOLEAN NOT NULL DEFAULT FALSE,
    corrected_from_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    is_one_off BOOLEAN NOT NULL DEFAULT FALSE
);

-- ==============================================================================
-- Indexes for Performance & Query Speed
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_allowance_cycles_user_active ON public.allowance_cycles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_user ON public.recurring_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

-- User Profiles: users can only view and update their own profile
CREATE POLICY "Users can manage own profile"
    ON public.user_profiles
    FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allowance Cycles: users can only manage their own cycles
CREATE POLICY "Users can manage own allowance cycles"
    ON public.allowance_cycles
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Categories: users can view system categories OR manage their own
CREATE POLICY "Users can view system categories and manage own"
    ON public.categories
    FOR SELECT
    USING (is_system = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can create own categories"
    ON public.categories
    FOR INSERT
    WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can update own categories"
    ON public.categories
    FOR UPDATE
    USING (auth.uid() = user_id AND is_system = FALSE)
    WITH CHECK (auth.uid() = user_id AND is_system = FALSE);

CREATE POLICY "Users can delete own categories"
    ON public.categories
    FOR DELETE
    USING (auth.uid() = user_id AND is_system = FALSE);

-- Transactions: users can only manage their own transactions
CREATE POLICY "Users can manage own transactions"
    ON public.transactions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Recurring Expenses: users can only manage their own recurring expenses
CREATE POLICY "Users can manage own recurring expenses"
    ON public.recurring_expenses
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- Seed Default Student Categories
-- ==============================================================================
INSERT INTO public.categories (name, icon, color_hex, is_system)
VALUES
    ('Food & Chai', 'Coffee', '#F97316', TRUE),
    ('Travel & Auto', 'Bus', '#06B6D4', TRUE),
    ('Hostel & Rent', 'Home', '#6366F1', TRUE),
    ('Mobile & Wi-Fi', 'Wifi', '#3B82F6', TRUE),
    ('Subscriptions', 'PlayCircle', '#EC4899', TRUE),
    ('Shopping & Books', 'ShoppingBag', '#10B981', TRUE),
    ('Health & Meds', 'Heart', '#EF4444', TRUE),
    ('Miscellaneous', 'MoreHorizontal', '#64748B', TRUE)
ON CONFLICT DO NOTHING;

-- Automatic user profile creation on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
