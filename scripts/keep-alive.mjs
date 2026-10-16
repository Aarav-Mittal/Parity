#!/usr/bin/env node

/**
 * Supabase Free Tier Keep-Alive Script
 *
 * Prevents Supabase Free Tier projects from pausing after 7 days of inactivity.
 * Runs a lightweight query against the public categories endpoint via the REST API.
 * 
 * Usage:
 *   node scripts/keep-alive.mjs
 *   (or configure in a GitHub Actions workflow on a 4-day cron schedule)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const appUrl = process.env.APP_URL;

async function pingSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('[keep-alive] No Supabase credentials found in environment. Skipping database ping.');
    return;
  }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/categories?select=id&limit=1`;
  const startTime = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    const elapsedMs = Date.now() - startTime;

    if (response.ok) {
      console.log(`[keep-alive] Supabase ping SUCCESS (HTTP ${response.status}) in ${elapsedMs}ms.`);
    } else if (response.status === 503) {
      console.warn(`[keep-alive] Supabase project appears PAUSED or initializing (HTTP 503).`);
      console.warn(`[keep-alive] Visit your Supabase dashboard to unpause the project: https://supabase.com/dashboard`);
    } else {
      console.warn(`[keep-alive] Supabase returned status HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    console.error(`[keep-alive] Network error during Supabase ping:`, err.message || err);
  }
}

async function pingApp() {
  if (!appUrl) return;

  const startTime = Date.now();
  try {
    const response = await fetch(appUrl, { method: 'GET' });
    const elapsedMs = Date.now() - startTime;
    console.log(`[keep-alive] Web App ping SUCCESS (HTTP ${response.status}) in ${elapsedMs}ms.`);
  } catch (err) {
    console.warn(`[keep-alive] Web App ping failed:`, err.message || err);
  }
}

async function main() {
  console.log(`--- AI Money Tracker Keep-Alive Ping [${new Date().toISOString()}] ---`);
  await pingSupabase();
  await pingApp();
  console.log('--- Done ---');
}

main();
