import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type FloveSupabaseClient = SupabaseClient<Database>;

export interface CreateFloveSupabaseClientOptions {
  url: string;
  anonKey: string;
  storage?: SupportedStorage;
}

export function createFloveSupabaseClient({
  url,
  anonKey,
  storage,
}: CreateFloveSupabaseClientOptions): FloveSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
}
