import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from '@/providers/AppProviders';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="auth/reset-password" />
        <Stack.Screen name="chat/[conversationId]" />
        <Stack.Screen name="preference-chat" />
      </Stack>
    </AppProviders>
  );
}
