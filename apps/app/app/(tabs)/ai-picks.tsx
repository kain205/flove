import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { acceptPick, declinePick, loadOrGenerateTodayMatches } from '@/services/matching';
import { colors } from '@/theme';
import type { CuratedMatch } from '@flove/core';

export default function AiPicksScreen() {
  const queryClient = useQueryClient();
  const matchesQuery = useQuery({
    queryKey: ['ai-picks', 'today'],
    queryFn: loadOrGenerateTodayMatches,
  });
  const acceptMutation = useMutation({
    mutationFn: acceptPick,
    onSuccess: result => {
      Alert.alert(result.isMutual ? 'Matched!' : 'Da accept', result.isMutual ? 'Conversation da san sang.' : 'Cho ban kia accept nua nhe.');
      void queryClient.invalidateQueries({ queryKey: ['ai-picks'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const declineMutation = useMutation({
    mutationFn: declinePick,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ai-picks'] }),
  });

  if (matchesQuery.isLoading) {
    return <Screen><ActivityIndicator /></Screen>;
  }

  const matches = matchesQuery.data?.matches ?? [];

  return (
    <Screen>
      <Text style={styles.title}>AI Picks</Text>
      <Text style={styles.subtitle}>Daily curated recommendations, backed by Supabase Edge Functions.</Text>
      {matches.length === 0 ? (
        <Text style={styles.empty}>Chua co pick nao. Hay hoan thien profile hoac seed them users.</Text>
      ) : matches.map((match: CuratedMatch) => (
        <View key={match.id} style={styles.card}>
          <Text style={styles.name}>{match.candidate.name}</Text>
          <Text style={styles.meta}>{match.compatibilityLabel} · {match.compatibilityScore}%</Text>
          <Text style={styles.body}>{match.aiReason}</Text>
          <View style={styles.actions}>
            <Button variant="secondary" onPress={() => declineMutation.mutate(match.id)}>Skip</Button>
            <Button onPress={() => acceptMutation.mutate(match.id)}>Accept</Button>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 15 },
  empty: { color: colors.muted, lineHeight: 22 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { color: colors.primaryDark, fontWeight: '700' },
  body: { color: colors.text, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10 },
});
