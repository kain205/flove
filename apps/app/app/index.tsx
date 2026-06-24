import { Redirect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getProfileReadiness } from '@flove/core';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { WebLanding } from '@/screens/WebLanding';
import { Welcome } from '@/screens/Welcome';
import { loadCurrentProfile } from '@/services/profile';
import { colors } from '@/theme';

export default function IndexRoute() {
  const { session, isLoading } = useAuth();
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: loadCurrentProfile,
    enabled: Boolean(session),
  });

  if (isLoading || (session && profileQuery.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session) {
    const profile = profileQuery.data;
    if (!profile || !getProfileReadiness(profile).isComplete) return <Redirect href="/onboarding" />;
    return <Redirect href="/ai-picks" />;
  }

  // Unauthenticated entry point: marketing landing on web, splash on native.
  return Platform.OS === 'web' ? <WebLanding /> : <Welcome />;
}
