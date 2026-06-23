import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { assertFptEmail } from '@flove/core';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithPassword(email: string, password: string) {
  assertFptEmail(email);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string) {
  assertFptEmail(email);
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: Linking.createURL('/auth/callback'),
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL('/auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) return;
  await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
}

export async function sendPasswordReset(email: string) {
  assertFptEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: Linking.createURL('/auth/reset-password'),
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
