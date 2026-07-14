import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { isProfileReady } from '@flove/core';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { useAuth } from '@/providers/AuthProvider';
import { WebLanding } from '@/screens/WebLanding';
import { Welcome } from '@/screens/Welcome';
import { loadCurrentProfile, profileQueryKey } from '@/services/profile';
import { colors } from '@/theme';

export default function IndexRoute() {
  const { session, isLoading } = useAuth();
  const profileQuery = useQuery({
    queryKey: profileQueryKey(session?.user.id),
    queryFn: () => loadCurrentProfile(session?.user.id),
    enabled: Boolean(session),
  });

  if (isLoading || (session && profileQuery.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session && profileQuery.isError && !profileQuery.data) {
    return (
      <View style={{ flex: 1, gap: 14, padding: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>Chưa tải được hồ sơ</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Kết nối có thể đang gián đoạn. Hồ sơ của bạn vẫn được giữ nguyên.</Text>
        <Button onPress={() => void profileQuery.refetch()}>Thử lại</Button>
      </View>
    );
  }

  if (session) {
    const profile = profileQuery.data;
    if (!isProfileReady(profile)) return <Redirect href="/onboarding" />;
    return <Redirect href="/ai-picks" />;
  }

  // Unauthenticated entry point: marketing landing on web, splash on native.
  return Platform.OS === 'web' ? <WebLanding /> : <Welcome />;
}
