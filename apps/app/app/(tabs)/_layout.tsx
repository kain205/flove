import { Redirect, Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { isProfileReady } from '@flove/core';
import { BookOpenCheck, MessageCircle, Sparkles, UserRound } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { ChatWidget } from '@/components/ChatWidget';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/providers/AuthProvider';
import { loadCurrentProfile, profileQueryKey } from '@/services/profile';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { session, isLoading } = useAuth();
  const profileQuery = useQuery({
    queryKey: profileQueryKey(session?.user.id),
    queryFn: () => loadCurrentProfile(session?.user.id),
    enabled: Boolean(session),
  });

  if (isLoading || (session && profileQuery.isLoading)) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  if (!session) return <Redirect href="/login" />;
  if (profileQuery.isError && !profileQuery.data) {
    return (
      <View style={{ flex: 1, gap: 14, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>Chưa tải được hồ sơ</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>F-Love không chuyển bạn về onboarding khi chưa xác định được trạng thái hồ sơ.</Text>
        <Button onPress={() => void profileQuery.refetch()}>Thử lại</Button>
      </View>
    );
  }
  if (!isProfileReady(profileQuery.data)) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1 }}>
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
        <Tabs.Screen name="course" options={{ title: t('course'), tabBarIcon: ({ color, size }) => <BookOpenCheck color={color} size={size} /> }} />
        <Tabs.Screen name="blind-date" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ title: t('messages'), tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
        <Tabs.Screen name="profile" options={{ title: t('profile'), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
      </Tabs>
      <ChatWidget />
    </View>
  );
}
