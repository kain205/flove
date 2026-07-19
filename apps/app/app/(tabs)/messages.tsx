import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MessageCircleHeart, Search, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import {
  conversationSummariesQueryKey,
  loadConversationSummaries,
} from '@/services/conversations';
import { colors, radii } from '@/theme';

function messageTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

export default function MessagesScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: conversationSummariesQueryKey(userId),
    queryFn: () => loadConversationSummaries(80),
    enabled: Boolean(userId),
  });
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    if (!term) return query.data ?? [];
    return (query.data ?? []).filter(row => (
      row.partnerName.toLocaleLowerCase('vi').includes(term)
      || row.lastMessageContent.toLocaleLowerCase('vi').includes(term)
    ));
  }, [query.data, search]);
  const unreadTotal = (query.data ?? []).reduce((sum, row) => sum + row.unreadCount, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>KẾT NỐI CỦA BẠN</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Tin nhắn</Text>
            {unreadTotal > 0 ? <View style={styles.totalBadge}><Text style={styles.totalBadgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text></View> : null}
          </View>
        </View>
        <View style={styles.aiMark}><Sparkles color={colors.primaryStrong} size={20} /></View>
      </View>

      <View style={styles.searchWrap}>
        <Search color={colors.muted} size={18} />
        <TextInput
          accessibilityLabel="Tìm cuộc trò chuyện"
          onChangeText={setSearch}
          placeholder="Tìm theo tên hoặc tin nhắn…"
          placeholderTextColor={colors.mutedLight}
          style={styles.searchInput}
          value={search}
        />
      </View>

      {query.isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Đang tải những cuộc trò chuyện…</Text></View>
      ) : query.isError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Chưa tải được tin nhắn</Text>
          <Text style={styles.stateText}>{query.error instanceof Error ? query.error.message : 'Vui lòng thử lại.'}</Text>
          <Pressable onPress={() => void query.refetch()} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><MessageCircleHeart color={colors.primaryStrong} size={28} /></View>
          <Text style={styles.emptyTitle}>{search ? 'Không tìm thấy cuộc trò chuyện' : 'Một lời chào đang chờ'}</Text>
          <Text style={styles.emptyBody}>{search ? 'Thử một tên hoặc từ khóa khác nhé.' : 'Khi hai bạn cùng thích nhau, cuộc trò chuyện sẽ xuất hiện ở đây.'}</Text>
          {!search ? <Pressable onPress={() => router.push('/ai-picks')}><Text style={styles.discover}>Khám phá AI Picks</Text></Pressable> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.listHead}><Text style={styles.listLabel}>GẦN ĐÂY</Text><Text style={styles.listCount}>{rows.length} cuộc trò chuyện</Text></View>
          {rows.map(row => (
            <Pressable
              accessibilityLabel={`Mở trò chuyện với ${row.partnerName}`}
              key={row.conversationId}
              onPress={() => router.push(`/chat/${row.conversationId}`)}
              style={({ pressed }) => [styles.row, row.unreadCount > 0 && styles.rowUnread, pressed && styles.rowPressed]}
            >
              <View>
                <Avatar imageUrl={row.partnerAvatarUrl} name={row.partnerName} size={56} />
                {row.isAnonymous ? <View style={styles.privateDot}><Text style={styles.privateDotText}>?</Text></View> : null}
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text numberOfLines={1} style={[styles.name, row.unreadCount > 0 && styles.nameUnread]}>{row.partnerName}</Text>
                  <Text style={[styles.time, row.unreadCount > 0 && styles.timeUnread]}>{messageTime(row.lastMessageCreatedAt)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text numberOfLines={1} style={[styles.preview, row.unreadCount > 0 && styles.previewUnread]}>
                    {row.lastMessageContent ? `${row.lastMessageIsMine ? 'Bạn: ' : ''}${row.lastMessageContent}` : 'Bắt đầu cuộc trò chuyện'}
                  </Text>
                  {row.unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{row.unreadCount > 99 ? '99+' : row.unreadCount}</Text></View> : null}
                </View>
              </View>
            </Pressable>
          ))}
          <View style={styles.privacyNote}><Sparkles color={colors.primaryText} size={14} /><Text style={styles.privacyText}>Wingman chỉ tạo gợi ý riêng tư bên trong từng cuộc trò chuyện.</Text></View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  kicker: { color: colors.primaryText, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: 3 },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.7 },
  totalBadge: { alignItems: 'center', backgroundColor: colors.primaryStrong, borderRadius: radii.pill, justifyContent: 'center', minWidth: 23, paddingHorizontal: 6, paddingVertical: 3 },
  totalBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '900' },
  aiMark: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 18, height: 42, justifyContent: 'center', width: 42 },
  searchWrap: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 9, marginHorizontal: 18, marginTop: 17, paddingHorizontal: 14 },
  searchInput: { color: colors.text, flex: 1, fontSize: 13, minHeight: 47, outlineStyle: 'none' } as never,
  center: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 28 },
  stateText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  retryButton: { backgroundColor: colors.primaryStrong, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: colors.onPrimary, fontSize: 12, fontWeight: '900' },
  emptyCard: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 26, borderWidth: 1, gap: 8, margin: 24, maxWidth: 390, padding: 30 },
  emptyIcon: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 26, height: 62, justifyContent: 'center', marginBottom: 4, width: 62 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  discover: { color: colors.primaryText, fontSize: 12.5, fontWeight: '900', marginTop: 5 },
  list: { paddingBottom: 120, paddingHorizontal: 12, paddingTop: 18 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 9, paddingBottom: 7 },
  listLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  listCount: { color: colors.mutedLight, fontSize: 10.5 },
  row: { alignItems: 'center', borderColor: 'transparent', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 13, paddingHorizontal: 10, paddingVertical: 12 },
  rowUnread: { backgroundColor: 'rgba(255,255,255,0.7)', borderColor: colors.border },
  rowPressed: { backgroundColor: colors.surfaceTint },
  privateDot: { alignItems: 'center', backgroundColor: colors.text, borderColor: colors.background, borderRadius: 9, borderWidth: 2, bottom: -1, height: 18, justifyContent: 'center', position: 'absolute', right: -1, width: 18 },
  privateDotText: { color: colors.onPrimary, fontSize: 9, fontWeight: '900' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  name: { color: colors.text, flex: 1, fontSize: 14.5, fontWeight: '700' },
  nameUnread: { fontWeight: '900' },
  time: { color: colors.mutedLight, fontSize: 10.5 },
  timeUnread: { color: colors.primaryText, fontWeight: '800' },
  previewRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  preview: { color: colors.muted, flex: 1, fontSize: 12.5 },
  previewUnread: { color: colors.textSoft, fontWeight: '600' },
  badge: { alignItems: 'center', backgroundColor: colors.primaryStrong, borderRadius: 10, height: 20, justifyContent: 'center', minWidth: 20, paddingHorizontal: 5 },
  badgeText: { color: colors.onPrimary, fontSize: 9.5, fontWeight: '900' },
  privacyNote: { alignItems: 'center', backgroundColor: colors.noteBg, borderColor: colors.noteBorder, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 8, marginHorizontal: 6, marginTop: 15, padding: 12 },
  privacyText: { color: colors.noteText, flex: 1, fontSize: 10.5, lineHeight: 15 },
});
