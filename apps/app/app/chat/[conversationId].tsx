import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
};

async function loadMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

async function sendMessage(conversationId: string, content: string) {
  const { error } = await (supabase.from('messages') as any).insert({ conversation_id: conversationId, content });
  if (error) throw error;
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => loadMessages(conversationId),
    enabled: Boolean(conversationId),
  });
  const mutation = useMutation({
    mutationFn: () => sendMessage(conversationId, content.trim()),
    onSuccess: () => {
      setContent('');
      void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  if (query.isLoading) return <Screen><ActivityIndicator /></Screen>;

  return (
    <Screen scroll={false}>
      <Text style={styles.title}>Chat</Text>
      <View style={styles.messages}>
        {query.data?.map((message: MessageRow) => (
          <Text key={message.id} style={styles.message}>{message.content}</Text>
        ))}
      </View>
      <TextField label="Message" value={content} onChangeText={setContent} />
      <Button disabled={!content.trim()} onPress={() => mutation.mutate()}>Send</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  messages: { flex: 1, gap: 8 },
  message: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
  },
});
