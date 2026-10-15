import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Browser Client
 * 
 * Educational Note:
 * NEXT_PUBLIC_SUPABASE_ANON_KEY is safe to expose in client-side code.
 * Even though it is visible in the browser network tab, all database operations
 * are protected by PostgreSQL Row Level Security (RLS).
 * When a user signs in, Supabase attaches a signed JSON Web Token (JWT) with their `sub` (user_id).
 * The database engine automatically injects that ID into `auth.uid()`.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

/**
 * Helper to check if valid Supabase credentials have been configured.
 */
export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    Boolean(supabaseAnonKey) &&
    supabaseAnonKey !== 'placeholder-key'
  );
}
