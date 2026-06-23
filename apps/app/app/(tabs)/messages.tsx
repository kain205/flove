import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

type ConversationListRow = {
  conversation_id: string;
  unread_count: number;
  conversations: {
    id: string;
    updated_at: string;
    is_anonymous: boolean;
  } | null;
};

async function loadConversations() {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, unread_count, conversations(id, updated_at, is_anonymous)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConversationListRow[];
}

export default function MessagesScreen() {
  const query = useQuery({ queryKey: ['conversations'], queryFn: loadConversations });

  if (query.isLoading) return <Screen><ActivityIndicator /></Screen>;

  return (
    <Screen>
      <Text style={styles.title}>Messages</Text>
      {(query.data ?? []).length === 0 ? (
        <Text style={styles.empty}>Official matches will appear here after mutual accept.</Text>
      ) : query.data?.map((row: ConversationListRow) => (
        <Link key={row.conversation_id} href={`/chat/${row.conversation_id}`} style={styles.row}>
          Conversation {row.conversation_id}
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  empty: { color: colors.muted },
  row: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontWeight: '700',
  },
});
