/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Browser Supabase Client (Publishable / Anon Key Only)
 *
 * Strictly uses public VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY).
 * NEVER accesses SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in frontend code.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || '';

const supabasePublishableKey =
  (typeof import.meta !== 'undefined' &&
    ((import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY)) ||
  '';

export function isBrowserSupabaseConfigured(): boolean {
  return Boolean(String(supabaseUrl).trim() && String(supabasePublishableKey).trim());
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isBrowserSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(String(supabaseUrl).trim(), String(supabasePublishableKey).trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}
