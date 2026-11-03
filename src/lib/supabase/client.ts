import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Creates a browser-side Supabase client.
 * Persists user session in browser cookies for seamless refresh and SSR compatibility.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
