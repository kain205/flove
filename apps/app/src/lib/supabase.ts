import 'react-native-url-polyfill/auto';
import { createFloveSupabaseClient } from '@flove/supabase';
import { secureStorage } from './secureStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

export const supabase = createFloveSupabaseClient({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storage: secureStorage,
});
