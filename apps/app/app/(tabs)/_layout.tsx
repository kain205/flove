import { Redirect, Tabs } from 'expo-router';
import { MessageCircle, Shuffle, Sparkles, UserRound } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  if (!session) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="ai-picks" options={{ title: t('aiPicks'), tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} /> }} />
      <Tabs.Screen name="blind-date" options={{ title: t('blindDate'), tabBarIcon: ({ color, size }) => <Shuffle color={color} size={size} /> }} />
      <Tabs.Screen name="messages" options={{ title: t('messages'), tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
