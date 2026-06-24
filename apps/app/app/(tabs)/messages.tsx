import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
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

function shortId(id: string) {
  return id.slice(0, 8);
}

export default function MessagesScreen() {
  const query = useQuery({ queryKey: ['conversations'], queryFn: loadConversations });

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const rows = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Tin nhắn</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Các match chính thức sẽ xuất hiện ở đây sau khi cả hai cùng thích.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {rows.map(row => {
            const anonymous = row.conversations?.is_anonymous;
            const name = anonymous ? 'Người ẩn danh' : `Cuộc trò chuyện ${shortId(row.conversation_id)}`;
            return (
              <Pressable
                key={row.conversation_id}
                onPress={() => router.push(`/chat/${row.conversation_id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Avatar name={anonymous ? '?' : name} size={54} online={!anonymous} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {row.unread_count > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{row.unread_count}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {anonymous ? '[Blind Date] Trò chuyện ẩn danh' : 'Nhấn để mở cuộc trò chuyện'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  empty: { color: colors.muted, paddingHorizontal: 22, lineHeight: 21 },
  list: { paddingHorizontal: 14, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 18 },
  rowPressed: { backgroundColor: colors.surfaceTint },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, fontWeight: '700', fontSize: 15, color: colors.text },
  preview: { fontSize: 13, color: colors.muted, marginTop: 3 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primaryStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
});
