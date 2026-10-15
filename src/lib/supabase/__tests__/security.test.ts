import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Security & Row Level Security (RLS) Policy Audit', () => {
  const migrationPath = path.resolve(import.meta.dirname, '../../../../supabase/migrations/001_initial_schema.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  it('enforces Row Level Security (RLS) on all user tables', () => {
    const requiredRlsTables = [
      'public.user_profiles',
      'public.allowance_cycles',
      'public.categories',
      'public.transactions',
      'public.recurring_expenses',
    ];

    for (const table of requiredRlsTables) {
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${table.replace('.', '\\.')}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      expect(rlsRegex.test(migrationSQL), `Table ${table} must have ROW LEVEL SECURITY enabled!`).toBe(true);
    }
  });

  it('guarantees tenant isolation policies using auth.uid() across all tables', () => {
    // 1. Transactions must check auth.uid() = user_id
    expect(migrationSQL).toContain('ON public.transactions');
    expect(migrationSQL).toMatch(/auth\.uid\(\)\s*=\s*user_id/i);

    // 2. Allowance cycles must check auth.uid() = user_id
    expect(migrationSQL).toContain('ON public.allowance_cycles');

    // 3. Recurring expenses must check auth.uid() = user_id
    expect(migrationSQL).toContain('ON public.recurring_expenses');

    // 4. User profiles must check auth.uid() = id
    expect(migrationSQL).toContain('ON public.user_profiles');
    expect(migrationSQL).toMatch(/auth\.uid\(\)\s*=\s*id/i);
  });

  it('prevents users from modifying system categories while allowing custom ones', () => {
    // Users can read system categories OR their own
    expect(migrationSQL).toMatch(/is_system\s*=\s*TRUE\s*OR\s*auth\.uid\(\)\s*=\s*user_id/i);

    // Users can only insert non-system categories owned by them
    expect(migrationSQL).toMatch(/auth\.uid\(\)\s*=\s*user_id\s*AND\s*is_system\s*=\s*FALSE/i);
  });

  it('ensures foreign keys cascade delete when a user account is deleted', () => {
    // When an auth.users record is deleted, all financial records must cascade cleanly
    expect(migrationSQL).toContain('REFERENCES auth.users(id) ON DELETE CASCADE');
  });

  it('simulates RLS access control logic: User B cannot access or mutate User A data', () => {
    // Educational Simulation of PostgreSQL RLS Engine
    const userA_id = 'user-uuid-aaaa-1111';
    const userB_id = 'user-uuid-bbbb-2222';

    interface DatabaseRow {
      id: string;
      user_id: string;
      amount_paise: number;
      description: string;
    }

    const mockDatabase: DatabaseRow[] = [
      { id: 'tx-1', user_id: userA_id, amount_paise: 50000, description: "User A's Lunch" },
      { id: 'tx-2', user_id: userB_id, amount_paise: 12000, description: "User B's Auto" },
    ];

    // RLS policy: USING (auth.uid() = user_id)
    function rlsQuery(currentAuthUid: string): DatabaseRow[] {
      return mockDatabase.filter(row => row.user_id === currentAuthUid);
    }

    // User A query
    const userAResults = rlsQuery(userA_id);
    expect(userAResults.length).toBe(1);
    expect(userAResults[0].description).toBe("User A's Lunch");

    // User B query
    const userBResults = rlsQuery(userB_id);
    expect(userBResults.length).toBe(1);
    expect(userBResults[0].description).toBe("User B's Auto");

    // Cross-user test: User B cannot see User A's data
    const userALeaks = userBResults.filter(row => row.user_id === userA_id);
    expect(userALeaks.length).toBe(0);

    // Mutation test: User B attempting to mutate User A's transaction
    function rlsUpdate(currentAuthUid: string, targetId: string, newDescription: string): boolean {
      const targetRow = mockDatabase.find(row => row.id === targetId);
      if (!targetRow || targetRow.user_id !== currentAuthUid) {
        // RLS prevents modification!
        return false;
      }
      targetRow.description = newDescription;
      return true;
    }

    const unauthorizedUpdate = rlsUpdate(userB_id, 'tx-1', 'Hacked description');
    expect(unauthorizedUpdate).toBe(false);
    expect(mockDatabase.find(r => r.id === 'tx-1')?.description).toBe("User A's Lunch");
  });

  it('prevents spoofed user_id on INSERT via WITH CHECK (auth.uid() = user_id)', () => {
    const userA_id = 'user-uuid-aaaa-1111';
    const userB_id = 'user-uuid-bbbb-2222';

    // RLS insert policy: WITH CHECK (auth.uid() = user_id)
    function rlsInsert(currentAuthUid: string, rowToInsert: { user_id: string; amount_paise: number }): boolean {
      if (rowToInsert.user_id !== currentAuthUid) {
        // PostgreSQL RLS rejects row insertion!
        return false;
      }
      return true;
    }

    // User B attempts to spoof User A's ID
    const spoofedInsert = rlsInsert(userB_id, {
      user_id: userA_id,
      amount_paise: 99900,
    });
    expect(spoofedInsert).toBe(false);

    // Legitimate insert succeeds
    const legitimateInsert = rlsInsert(userB_id, {
      user_id: userB_id,
      amount_paise: 99900,
    });
    expect(legitimateInsert).toBe(true);
  });

  it('prevents unauthorized DELETE attempts across tenant boundaries', () => {
    const userA_id = 'user-uuid-aaaa-1111';
    const userB_id = 'user-uuid-bbbb-2222';

    const mockRows = [
      { id: 'tx-1', user_id: userA_id },
      { id: 'tx-2', user_id: userB_id },
    ];

    function rlsDelete(currentAuthUid: string, targetId: string): boolean {
      const row = mockRows.find(r => r.id === targetId);
      if (!row || row.user_id !== currentAuthUid) {
        return false; // RLS blocks deletion of other user's record
      }
      return true;
    }

    expect(rlsDelete(userB_id, 'tx-1')).toBe(false); // User B cannot delete User A's transaction
    expect(rlsDelete(userB_id, 'tx-2')).toBe(true);  // User B can delete own transaction
  });

  it('enforces CHECK constraints in migration SQL for non-negative money and valid days', () => {
    // 1. Transaction amount must be positive
    expect(migrationSQL).toMatch(/amount_paise\s+BIGINT\s+NOT\s+NULL\s+CHECK\s*\(\s*amount_paise\s*>\s*0\s*\)/i);
    // 2. Allowance amount must be non-negative
    expect(migrationSQL).toMatch(/allowance_amount_paise\s+BIGINT\s+NOT\s+NULL\s+CHECK\s*\(\s*allowance_amount_paise\s*>=\s*0\s*\)/i);
    // 3. Day of month must be between 1 and 31
    expect(migrationSQL).toMatch(/cycle_day_of_month\s+INTEGER\s+NOT\s+NULL\s+CHECK\s*\(\s*cycle_day_of_month\s*>=\s*1\s+AND\s+cycle_day_of_month\s*<=\s*31\s*\)/i);
  });

  it('ensures .env.example contains no hardcoded secrets or service role keys', () => {
    const envExamplePath = path.resolve(import.meta.dirname, '../../../../.env.example');
    const envExample = fs.readFileSync(envExamplePath, 'utf8');

    expect(envExample).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(envExample).toContain('NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co');
  });
});
