import { Redirect, Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getProfileReadiness } from '@flove/core';
import { MessageCircle, Shuffle, Sparkles, UserRound } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { loadCurrentProfile } from '@/services/profile';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { session, isLoading } = useAuth();
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: loadCurrentProfile,
    enabled: Boolean(session),
  });

  if (isLoading || (session && profileQuery.isLoading)) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  if (!session) return <Redirect href="/login" />;
  if (!profileQuery.data || !getProfileReadiness(profileQuery.data).isComplete) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryStrong,
        tabBarInactiveTintColor: colors.mutedLight,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 74,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="ai-picks" options={{ title: t('aiPicks'), tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} /> }} />
      <Tabs.Screen name="blind-date" options={{ title: t('blindDate'), tabBarIcon: ({ color, size }) => <Shuffle color={color} size={size} /> }} />
      <Tabs.Screen name="messages" options={{ title: t('messages'), tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
