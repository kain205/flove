import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { colors, gradients, radii } from '@/theme';

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
  const { session } = useAuth();
  const myId = session?.user?.id;
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Avatar name="Match" size={42} />
        <View>
          <Text style={styles.headerName}>Cuộc trò chuyện</Text>
          <Text style={styles.headerStatus}>● Đang hoạt động</Text>
        </View>
      </View>

      {query.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {(query.data ?? []).map(message => {
            const mine = myId != null && message.sender_id === myId;
            return mine ? (
              <LinearGradient
                key={message.id}
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bubble, styles.bubbleMine]}
              >
                <Text style={styles.bubbleMineText}>{message.content}</Text>
              </LinearGradient>
            ) : (
              <View key={message.id} style={[styles.bubble, styles.bubbleTheirs]}>
                <Text style={styles.bubbleTheirsText}>{message.content}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Nhắn tin..."
          placeholderTextColor={colors.mutedLight}
          style={styles.input}
          onSubmitEditing={() => content.trim() && mutation.mutate()}
        />
        <Pressable onPress={() => mutation.mutate()} disabled={!content.trim() || mutation.isPending} style={styles.sendShadow}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
            <Text style={styles.sendText}>➤</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { fontSize: 30, color: colors.primaryStrong, lineHeight: 30, paddingRight: 4 },
  headerName: { fontWeight: '700', fontSize: 15, color: colors.text },
  headerStatus: { fontSize: 11.5, color: colors.online, fontWeight: '600', marginTop: 1 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messages: { padding: 18, gap: 10 },
  bubble: { maxWidth: '78%', paddingVertical: 11, paddingHorizontal: 14 },
  bubbleMine: { alignSelf: 'flex-end', borderRadius: 18, borderBottomRightRadius: 5 },
  bubbleMineText: { color: colors.onPrimary, fontSize: 14, lineHeight: 20 },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
  },
  bubbleTheirsText: { color: colors.text, fontSize: 14, lineHeight: 20 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.text,
  },
  sendShadow: {
    borderRadius: 22,
    shadowColor: '#D6764C',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.onPrimary, fontSize: 18 },
});
