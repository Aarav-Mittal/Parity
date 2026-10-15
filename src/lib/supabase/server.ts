import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Server Client Helpers
 * 
 * Educational Note: Credential Separation
 * - Anon Key: Safe for client and standard user operations, enforced by RLS.
 * - Service Role Key: STRICTLY SERVER-SIDE. Bypasses Row Level Security (RLS).
 *   Never commit, never expose in NEXT_PUBLIC_ variables.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Creates a server-side Supabase client scoped to an authenticated user's access token.
 */
export function createServerClientWithToken(accessToken?: string) {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    }
  );
}
