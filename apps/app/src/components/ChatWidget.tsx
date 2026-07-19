import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, ExternalLink, MessageCircle, Send, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ConversationSummary } from '@flove/supabase';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import {
  acknowledgeConversation,
  conversationMessagesQueryKey,
  conversationSummariesQueryKey,
  loadConversationMessages,
  loadConversationSummaries,
  newClientMessageId,
  sendSharedMessage,
} from '@/services/conversations';
import { colors, gradients, radii } from '@/theme';

function shortTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ChatWidget() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { width, height } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const clientMessageIdRef = useRef<string | null>(null);
  const summaries = useQuery({
    queryKey: conversationSummariesQueryKey(userId),
    queryFn: () => loadConversationSummaries(12),
    enabled: Boolean(userId),
  });
  const messages = useQuery({
    queryKey: conversationMessagesQueryKey(userId, selectedId ?? 'none'),
    queryFn: () => loadConversationMessages(selectedId ?? '', 20),
    enabled: Boolean(userId && selectedId && open),
  });
  const send = useMutation({
    mutationFn: (input: { conversationId: string; content: string; clientMessageId: string; expectedUserId: string }) => sendSharedMessage(input),
    onSuccess: async (_result, input) => {
      if (input.expectedUserId !== userId || input.conversationId !== selectedId) return;
      clientMessageIdRef.current = null;
      setDraft('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(userId, input.conversationId) }),
        queryClient.invalidateQueries({ queryKey: conversationSummariesQueryKey(userId) }),
      ]);
    },
  });

  useEffect(() => {
    if (!open || !selectedId) return;
    void acknowledgeConversation(selectedId)
      .then(() => queryClient.invalidateQueries({ queryKey: conversationSummariesQueryKey(userId) }))
      .catch(() => undefined);
  }, [open, queryClient, selectedId, userId]);

  useEffect(() => {
    setDraft('');
    clientMessageIdRef.current = null;
    send.reset();
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!userId) return null;

  const rows = summaries.data ?? [];
  const selected = rows.find(row => row.conversationId === selectedId) ?? null;
  const unreadTotal = rows.reduce((sum, row) => sum + row.unreadCount, 0);
  const panelWidth = Math.min(380, Math.max(292, width - 24));
  const panelHeight = Math.min(560, Math.max(390, height - 150));

  const selectConversation = (row: ConversationSummary) => {
    setSelectedId(row.conversationId);
  };
  const submit = () => {
    const content = draft.trim();
    if (!content || !selectedId || send.isPending) return;
    clientMessageIdRef.current ??= newClientMessageId();
    send.mutate({ conversationId: selectedId, content, clientMessageId: clientMessageIdRef.current, expectedUserId: userId });
  };

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      {open ? (
        <View accessibilityLabel="Chat nhanh" style={[styles.panel, { height: panelHeight, width: panelWidth }]}>
          {selected ? (
            <>
              <View style={styles.chatHeader}>
                <Pressable accessibilityLabel="Về danh sách trò chuyện" hitSlop={7} onPress={() => setSelectedId(null)} style={styles.headerButton}><ArrowLeft color={colors.text} size={18} /></Pressable>
                <Avatar imageUrl={selected.partnerAvatarUrl} name={selected.partnerName} size={38} />
                <View style={styles.headerCopy}><Text numberOfLines={1} style={styles.headerName}>{selected.partnerName}</Text><Text style={styles.headerHint}>Chat nhanh · đồng bộ tức thì</Text></View>
                <Pressable accessibilityLabel="Mở toàn màn hình" hitSlop={7} onPress={() => { setOpen(false); router.push(`/chat/${selected.conversationId}`); }} style={styles.headerButton}><ExternalLink color={colors.primaryText} size={17} /></Pressable>
              </View>
              {messages.isLoading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
              ) : messages.isError ? (
                <View style={styles.center}><Text style={styles.stateText}>Chưa tải được tin nhắn.</Text><Pressable onPress={() => void messages.refetch()}><Text style={styles.retry}>Thử lại</Text></Pressable></View>
              ) : (
                <ScrollView contentContainerStyle={styles.quickMessages} showsVerticalScrollIndicator={false}>
                  {(messages.data ?? []).slice(-20).map(message => (
                    <View key={message.id} style={message.isMine ? styles.quickMineWrap : styles.quickTheirsWrap}>
                      <View style={[styles.quickBubble, message.isMine ? styles.quickMine : styles.quickTheirs]}><Text style={message.isMine ? styles.quickMineText : styles.quickTheirsText}>{message.content}</Text></View>
                      <Text style={styles.quickTime}>{shortTime(message.createdAt)}</Text>
                    </View>
                  ))}
                  {send.isPending ? <View style={styles.quickMineWrap}><View style={[styles.quickBubble, styles.quickMine, { opacity: 0.65 }]}><Text style={styles.quickMineText}>{draft.trim()}</Text></View><Text style={styles.quickTime}>Đang gửi…</Text></View> : null}
                </ScrollView>
              )}
              {send.isError ? <View style={styles.sendError}><Text style={styles.sendErrorText}>{send.error instanceof Error ? send.error.message : 'Chưa gửi được.'}</Text><Pressable onPress={submit}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}
              <View style={styles.composer}>
                <TextInput
                  accessibilityLabel="Nhắn tin nhanh"
                  maxLength={4000}
                  onChangeText={value => { setDraft(value); if (send.isError) { clientMessageIdRef.current = null; send.reset(); } }}
                  onSubmitEditing={submit}
                  placeholder="Viết một lời nhắn…"
                  placeholderTextColor={colors.mutedLight}
                  style={styles.input}
                  value={draft}
                />
                <Pressable accessibilityLabel="Gửi tin nhắn nhanh" disabled={!draft.trim() || send.isPending} onPress={submit} style={({ pressed }) => [styles.sendButton, (!draft.trim() || send.isPending) && styles.disabled, pressed && styles.pressed]}>
                  <LinearGradient colors={gradients.brand} style={styles.sendGradient}><Send color={colors.onPrimary} size={16} /></LinearGradient>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.listHeader}>
                <View><Text style={styles.eyebrow}>CHAT NHANH</Text><Text style={styles.panelTitle}>Tin nhắn gần đây</Text></View>
                <Pressable accessibilityLabel="Đóng chat nhanh" hitSlop={8} onPress={() => setOpen(false)} style={styles.closeButton}><X color={colors.textSoft} size={18} /></Pressable>
              </View>
              <Text style={styles.privateCopy}>Cùng dữ liệu với inbox. Không có bot nào tự gửi thay bạn.</Text>
              {summaries.isLoading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
              ) : summaries.isError ? (
                <View style={styles.center}><Text style={styles.stateText}>Chưa tải được trò chuyện.</Text><Pressable onPress={() => void summaries.refetch()}><Text style={styles.retry}>Thử lại</Text></Pressable></View>
              ) : rows.length === 0 ? (
                <View style={styles.center}><MessageCircle color={colors.primary} size={28} /><Text style={styles.stateTitle}>Chưa có cuộc trò chuyện</Text><Text style={styles.stateText}>Match chính thức sẽ xuất hiện ở đây.</Text></View>
              ) : (
                <ScrollView contentContainerStyle={styles.quickList} showsVerticalScrollIndicator={false}>
                  {rows.map(row => (
                    <Pressable key={row.conversationId} onPress={() => selectConversation(row)} style={({ pressed }) => [styles.quickRow, pressed && styles.quickRowPressed]}>
                      <Avatar imageUrl={row.partnerAvatarUrl} name={row.partnerName} size={43} />
                      <View style={styles.quickRowCopy}><View style={styles.quickRowTop}><Text numberOfLines={1} style={styles.quickName}>{row.partnerName}</Text><Text style={styles.quickRowTime}>{shortTime(row.lastMessageCreatedAt)}</Text></View><Text numberOfLines={1} style={styles.quickPreview}>{row.lastMessageIsMine ? 'Bạn: ' : ''}{row.lastMessageContent || 'Bắt đầu trò chuyện'}</Text></View>
                      {row.unreadCount > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{row.unreadCount > 9 ? '9+' : row.unreadCount}</Text></View> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <Pressable onPress={() => { setOpen(false); router.push('/messages'); }} style={styles.openInbox}><Text style={styles.openInboxText}>Mở toàn bộ tin nhắn</Text><ExternalLink color={colors.primaryText} size={14} /></Pressable>
            </>
          )}
        </View>
      ) : null}

      <Pressable accessibilityLabel={open ? 'Đóng chat nhanh' : 'Mở chat nhanh'} onPress={() => setOpen(value => !value)} style={({ pressed }) => [styles.launcher, pressed && styles.pressed]}>
        <LinearGradient colors={gradients.brand} style={styles.launcherGradient}>{open ? <X color={colors.onPrimary} size={23} /> : <MessageCircle color={colors.onPrimary} size={23} />}</LinearGradient>
        {!open && unreadTotal > 0 ? <View style={styles.launcherBadge}><Text style={styles.launcherBadgeText}>{unreadTotal > 99 ? '99+' : unreadTotal}</Text></View> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { bottom: 83, position: 'absolute', right: 14, zIndex: 50 },
  launcher: { alignSelf: 'flex-end', borderRadius: 29, elevation: 10, marginTop: 10, shadowColor: '#B65317', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18 },
  launcherGradient: { alignItems: 'center', borderRadius: 29, height: 56, justifyContent: 'center', width: 56 },
  launcherBadge: { alignItems: 'center', backgroundColor: '#2F251F', borderColor: colors.background, borderRadius: 11, borderWidth: 2, justifyContent: 'center', minHeight: 21, minWidth: 21, paddingHorizontal: 4, position: 'absolute', right: -3, top: -4 },
  launcherBadgeText: { color: colors.onPrimary, fontSize: 8.5, fontWeight: '900' },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 25, borderWidth: 1, elevation: 12, overflow: 'hidden', shadowColor: '#7C4B2A', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 30 },
  listHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 17 },
  eyebrow: { color: colors.primaryText, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.5 },
  panelTitle: { color: colors.text, fontSize: 19, fontWeight: '900', letterSpacing: -0.4, marginTop: 2 },
  closeButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 15, height: 34, justifyContent: 'center', width: 34 },
  privateCopy: { color: colors.muted, fontSize: 10.5, lineHeight: 15, paddingHorizontal: 18, paddingTop: 7 },
  center: { alignItems: 'center', flex: 1, gap: 7, justifyContent: 'center', padding: 22 },
  stateTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  stateText: { color: colors.muted, fontSize: 10.5, lineHeight: 15, textAlign: 'center' },
  retry: { color: colors.primaryText, fontSize: 10.5, fontWeight: '900' },
  quickList: { gap: 2, padding: 10 },
  quickRow: { alignItems: 'center', borderRadius: 17, flexDirection: 'row', gap: 10, padding: 9 },
  quickRowPressed: { backgroundColor: colors.surfaceTint },
  quickRowCopy: { flex: 1, minWidth: 0 },
  quickRowTop: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  quickName: { color: colors.text, flex: 1, fontSize: 12.5, fontWeight: '800' },
  quickRowTime: { color: colors.mutedLight, fontSize: 8.5 },
  quickPreview: { color: colors.muted, fontSize: 10.5, marginTop: 3 },
  unread: { alignItems: 'center', backgroundColor: colors.primaryStrong, borderRadius: 9, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 4 },
  unreadText: { color: colors.onPrimary, fontSize: 8, fontWeight: '900' },
  openInbox: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', padding: 13 },
  openInboxText: { color: colors.primaryText, fontSize: 10.5, fontWeight: '900' },
  chatHeader: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 9, padding: 11 },
  headerButton: { alignItems: 'center', borderRadius: 13, height: 32, justifyContent: 'center', width: 32 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerName: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  headerHint: { color: colors.muted, fontSize: 8.5, marginTop: 2 },
  quickMessages: { padding: 12 },
  quickMineWrap: { alignItems: 'flex-end', marginBottom: 8 },
  quickTheirsWrap: { alignItems: 'flex-start', marginBottom: 8 },
  quickBubble: { maxWidth: '84%', paddingHorizontal: 11, paddingVertical: 8 },
  quickMine: { backgroundColor: colors.primaryStrong, borderBottomRightRadius: 4, borderRadius: 15 },
  quickTheirs: { backgroundColor: colors.background, borderBottomLeftRadius: 4, borderColor: colors.border, borderRadius: 15, borderWidth: 1 },
  quickMineText: { color: colors.onPrimary, fontSize: 10.5, lineHeight: 15 },
  quickTheirsText: { color: colors.text, fontSize: 10.5, lineHeight: 15 },
  quickTime: { color: colors.mutedLight, fontSize: 7.5, marginHorizontal: 3, marginTop: 2 },
  composer: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 8, padding: 10 },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, color: colors.text, flex: 1, fontSize: 11, minHeight: 39, paddingHorizontal: 13, paddingVertical: 9 },
  sendButton: { borderRadius: 19 },
  sendGradient: { alignItems: 'center', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  sendError: { alignItems: 'center', backgroundColor: '#FFF0EA', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  sendErrorText: { color: '#A7442E', flex: 1, fontSize: 9.5 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
