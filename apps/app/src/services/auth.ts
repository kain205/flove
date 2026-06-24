import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { assertFptEmail } from '@flove/core';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function createAuthRedirect(path: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString();
  }

  return Linking.createURL(path);
}

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
      emailRedirectTo: createAuthRedirect('/auth/callback'),
    },
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const redirectTo = createAuthRedirect('/auth/callback');
  const shouldOpenAuthSession = Platform.OS !== 'web';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: shouldOpenAuthSession,
    },
  });
  if (error) throw error;
  if (shouldOpenAuthSession && data.url) {
    await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  }
}

export async function sendPasswordReset(email: string) {
  assertFptEmail(email);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: createAuthRedirect('/auth/reset-password'),
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
