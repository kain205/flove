import { useMutation } from '@tanstack/react-query';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

async function findBlindDatePartner() {
  const { data, error } = await supabase.functions.invoke('find-blind-date-partner');
  if (error) throw error;
  return data as { waiting: boolean; conversationId?: string; partnerMaskedName?: string };
}

export default function BlindDateScreen() {
  const mutation = useMutation({
    mutationFn: findBlindDatePartner,
    onSuccess: data => {
      Alert.alert(
        data.waiting ? 'Dang cho' : 'Da ghep doi',
        data.waiting ? 'Minh se giu ban trong hang cho.' : `Partner: ${data.partnerMaskedName ?? 'Anonymous'}`
      );
    },
  });

  return (
    <Screen>
      <Text style={styles.title}>Blind Date</Text>
      <Text style={styles.body}>Anonymous chat remains separate from AI Picks and can be hardened after core matching.</Text>
      <Button onPress={() => mutation.mutate()}>Find partner</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  body: { color: colors.muted, lineHeight: 22 },
});
