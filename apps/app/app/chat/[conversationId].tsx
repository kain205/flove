import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  getBlindDateSession,
  getBlindDateSessionForConversation,
  requestBlindDateReveal,
  type ConversationMessage,
} from '@flove/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LockKeyhole, RefreshCw, Send, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  acknowledgeConversation,
  conversationMessagesQueryKey,
  conversationSummariesQueryKey,
  conversationSummaryQueryKey,
  loadConversationMessages,
  loadConversationSummary,
  newClientMessageId,
  sendSharedMessage,
} from '@/services/conversations';
import {
  askConversationWingman,
  newWingmanRequestId,
  type WingmanRequest,
} from '@/services/wingman';
import { colors, gradients, radii } from '@/theme';

function clockTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Hôm nay';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);
}

export default function ChatScreen() {
  const { conversationId, blindSessionId } = useLocalSearchParams<{
    conversationId: string;
    blindSessionId?: string;
  }>();
  const { session } = useAuth();
  const myId = session?.user?.id;
  const [content, setContent] = useState('');
  const [wingmanOpen, setWingmanOpen] = useState(false);
  const [wingmanSuggestions, setWingmanSuggestions] = useState<[string, string, string] | null>(null);
  const [failedWingman, setFailedWingman] = useState<{ input: WingmanRequest; message: string } | null>(null);
  const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);
  const pendingSendRef = useRef<{ content: string; clientMessageId: string; userId: string } | null>(null);
  const markedReadVersionRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const blindSessionQueryKey = ['blind-date-session', myId, blindSessionId ?? `conversation:${conversationId}`] as const;

  useEffect(() => {
    setContent('');
    setWingmanOpen(false);
    setWingmanSuggestions(null);
    setFailedWingman(null);
    setPendingSuggestion(null);
    pendingSendRef.current = null;
    markedReadVersionRef.current = null;
  }, [conversationId, myId]);

  const query = useQuery({
    queryKey: conversationMessagesQueryKey(myId, conversationId),
    queryFn: () => loadConversationMessages(conversationId),
    enabled: Boolean(conversationId && myId),
  });
  const summaryQuery = useQuery({
    queryKey: conversationSummaryQueryKey(myId, conversationId),
    queryFn: () => loadConversationSummary(conversationId),
    enabled: Boolean(conversationId && myId),
  });
  const blindSessionQuery = useQuery({
    queryKey: blindSessionQueryKey,
    queryFn: () => blindSessionId
      ? getBlindDateSession(supabase, blindSessionId)
      : getBlindDateSessionForConversation(supabase, conversationId),
    enabled: Boolean(myId && conversationId),
    refetchInterval: queryState => {
      const state = queryState.state.data;
      return state && !state.isRevealed ? 5_000 : false;
    },
  });
  useFocusEffect(useCallback(() => {
    if (!myId || !conversationId || !query.isSuccess) return;
    const version = `${myId}:${conversationId}:${query.dataUpdatedAt}`;
    if (markedReadVersionRef.current === version) return;
    markedReadVersionRef.current = version;
    void acknowledgeConversation(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: conversationSummariesQueryKey(myId) }))
      .catch(() => {
        if (markedReadVersionRef.current === version) markedReadVersionRef.current = null;
      });
  }, [conversationId, myId, query.dataUpdatedAt, query.isSuccess, queryClient]));
  const revealMutation = useMutation({
    mutationFn: (input: { sessionId: string; userId: string }) =>
      requestBlindDateReveal(supabase, input.sessionId, input.userId),
    onSuccess: async (_result, input) => {
      if (input.userId !== myId) return;
      await queryClient.invalidateQueries({
        queryKey: ['blind-date-session', input.userId],
      });
    },
    onError: (error, input) => {
      if (input.userId !== myId) return;
      Alert.alert('Chưa lưu được yêu cầu', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    },
  });
  const mutation = useMutation({
    mutationFn: (input: { content: string; clientMessageId: string; userId: string }) =>
      sendSharedMessage({
        conversationId,
        content: input.content,
        clientMessageId: input.clientMessageId,
        expectedUserId: input.userId,
      }),
    onSuccess: (_result, input) => {
      if (input.userId !== myId) return;
      pendingSendRef.current = null;
      setContent('');
      setWingmanOpen(false);
      setWingmanSuggestions(null);
      setFailedWingman(null);
      void queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(myId, conversationId) });
      void queryClient.invalidateQueries({ queryKey: conversationSummariesQueryKey(myId) });
      void queryClient.invalidateQueries({ queryKey: conversationSummaryQueryKey(myId, conversationId) });
    },
  });
  const wingmanMutation = useMutation({
    mutationFn: askConversationWingman,
    retry: false,
    onSuccess: (result, input) => {
      if (input.userId !== myId || input.conversationId !== conversationId) return;
      setWingmanSuggestions(result.suggestions);
      setFailedWingman(null);
    },
    onError: (error, input) => {
      if (input.userId !== myId || input.conversationId !== conversationId) return;
      setFailedWingman({
        input,
        message: error instanceof Error
          ? error.message
          : 'Wingman chưa tạo được gợi ý. Nội dung đang soạn của bạn vẫn được giữ nguyên.',
      });
    },
  });

  const requestWingman = () => {
    if (!myId || !conversationId || wingmanMutation.isPending) return;
    const draft = content.trim();
    const retryInput = failedWingman?.input.userId === myId
      && failedWingman.input.conversationId === conversationId
      && failedWingman.input.draft === draft
      ? failedWingman.input
      : null;
    const input = retryInput ?? {
      conversationId,
      draft,
      idempotencyKey: newWingmanRequestId(),
      userId: myId,
    };
    if (!retryInput) setFailedWingman(null);
    setWingmanSuggestions(null);
    wingmanMutation.mutate(input);
  };

  const toggleWingman = () => {
    const nextOpen = !wingmanOpen;
    setWingmanOpen(nextOpen);
    const unrevealedBlindDate = Boolean(blindSessionQuery.data && !blindSessionQuery.data.isRevealed);
    if (nextOpen && !unrevealedBlindDate && !wingmanSuggestions && !failedWingman && !wingmanMutation.isPending) {
      requestWingman();
    }
  };

  const chooseSuggestion = (suggestion: string) => {
    if (content.trim() && content.trim() !== suggestion) {
      setPendingSuggestion(suggestion);
      return;
    }
    setContent(suggestion);
  };

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || mutation.isPending) return;
    const pending = pendingSendRef.current;
    if (!myId) return;
    const input = pending?.content === trimmed && pending.userId === myId
      ? pending
      : { content: trimmed, clientMessageId: newClientMessageId(), userId: myId };
    pendingSendRef.current = input;
    mutation.mutate(input);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Avatar imageUrl={summaryQuery.data?.partnerAvatarUrl} name={summaryQuery.data?.partnerName ?? '?'} size={43} />
        <View style={styles.headerCopy}>
          <Text style={styles.headerName}>{summaryQuery.data?.partnerName ?? (summaryQuery.isLoading ? 'Đang tải…' : 'Cuộc trò chuyện')}</Text>
          <View style={styles.headerStatusRow}>
            {summaryQuery.data?.isAnonymous ? <LockKeyhole color={colors.muted} size={11} /> : null}
            <Text style={styles.headerStatus}>{summaryQuery.data?.isAnonymous ? 'Danh tính đang được bảo vệ' : 'Kết nối qua F-Love'}</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={wingmanOpen ? 'Đóng Wingman' : 'Mở Wingman'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={toggleWingman}
          style={({ pressed }) => [styles.wingmanHeaderButton, wingmanOpen && styles.wingmanHeaderButtonActive, pressed && styles.pressed]}
        >
          <Sparkles color={wingmanOpen ? colors.onPrimary : colors.primaryText} size={18} />
        </Pressable>
      </View>

      {query.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : query.isError ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>Chưa tải được cuộc trò chuyện.</Text>
          <Pressable onPress={() => void query.refetch()}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {blindSessionId || blindSessionQuery.data ? (
            <View style={styles.revealCard}>
              {blindSessionQuery.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : blindSessionQuery.isError ? (
                <>
                  <Text style={styles.revealTitle}>Chưa tải được trạng thái tiết lộ</Text>
                  <Pressable onPress={() => void blindSessionQuery.refetch()}>
                    <Text style={styles.retryText}>Thử lại</Text>
                  </Pressable>
                </>
              ) : blindSessionQuery.data ? (
                <>
                  <Text style={styles.revealTitle}>
                    {blindSessionQuery.data.isRevealed
                      ? 'Hai bạn đã cùng tiết lộ danh tính'
                      : `Bạn đang trò chuyện với ${blindSessionQuery.data.partnerMaskedName}`}
                  </Text>
                  <Text style={styles.revealBody}>
                    {blindSessionQuery.data.isRevealed
                      ? 'Danh tính chỉ được mở sau khi cả hai cùng đồng ý.'
                      : blindSessionQuery.data.requestedByMe
                        ? 'Đã gửi đồng ý. F-Love đang chờ người kia.'
                        : blindSessionQuery.data.requestedByPartner
                          ? 'Người kia đã sẵn sàng. Bạn có muốn đồng ý tiết lộ không?'
                          : 'Chỉ tiết lộ khi cả hai đều sẵn sàng.'}
                  </Text>
                  {!blindSessionQuery.data.isRevealed && !blindSessionQuery.data.requestedByMe ? (
                    <Pressable
                      disabled={!myId || revealMutation.isPending}
                      onPress={() => myId && blindSessionQuery.data && revealMutation.mutate({
                        sessionId: blindSessionQuery.data.sessionId,
                        userId: myId,
                      })}
                      style={styles.revealButton}
                    >
                      <Text style={styles.revealButtonText}>
                        {revealMutation.isPending ? 'Đang lưu…' : 'Tôi đồng ý tiết lộ'}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}
          {(query.data ?? []).map((message: ConversationMessage, index, messages) => {
            const previous = messages[index - 1];
            const showDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
            const bubble = message.isMine ? (
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMine]}>
                <Text style={styles.bubbleMineText}>{message.content}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.bubble, styles.bubbleTheirs]}><Text style={styles.bubbleTheirsText}>{message.content}</Text></View>
            );
            return (
              <View key={message.id}>
                {showDay ? <View style={styles.dayRow}><View style={styles.dayLine} /><Text style={styles.dayText}>{dayLabel(message.createdAt)}</Text><View style={styles.dayLine} /></View> : null}
                <View style={message.isMine ? styles.messageMine : styles.messageTheirs}>
                  {bubble}
                  <Text style={styles.messageMeta}>{clockTime(message.createdAt)}{message.isMine ? ` · ${message.isRead ? 'Đã xem' : 'Đã gửi'}` : ''}</Text>
                </View>
              </View>
            );
          })}
          {mutation.isPending && pendingSendRef.current ? (
            <View style={styles.messageMine}>
              <View style={[styles.bubble, styles.pendingBubble]}><Text style={styles.bubbleMineText}>{pendingSendRef.current.content}</Text></View>
              <Text style={styles.messageMeta}>Đang gửi…</Text>
            </View>
          ) : null}
          {mutation.isError && pendingSendRef.current ? (
            <View style={styles.sendError}>
              <Text style={styles.sendErrorText}>{mutation.error instanceof Error ? mutation.error.message : 'Chưa gửi được tin nhắn.'}</Text>
              <Pressable onPress={() => pendingSendRef.current && mutation.mutate(pendingSendRef.current)}><Text style={styles.retryText}>Thử gửi lại</Text></Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}

      {wingmanOpen ? (
        <View accessibilityLabel="Wingman riêng tư" style={styles.wingmanPanel}>
          <View style={styles.wingmanPanelHeader}>
            <View style={styles.wingmanTitleRow}>
              <Sparkles color={colors.primaryText} size={16} />
              <Text style={styles.wingmanTitle}>Wingman</Text>
            </View>
            <Text style={styles.wingmanPrivate}>Chỉ mình bạn thấy</Text>
          </View>

          {blindSessionQuery.data && !blindSessionQuery.data.isRevealed ? (
            <Text style={styles.wingmanBody}>
              Wingman chỉ khả dụng sau khi cả hai đã đồng ý tiết lộ trong Blind Date.
            </Text>
          ) : wingmanMutation.isPending ? (
            <View style={styles.wingmanLoading}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.wingmanBody}>Đang chuẩn bị ba cách trả lời…</Text>
            </View>
          ) : failedWingman ? (
            <View style={styles.wingmanError}>
              <Text accessibilityRole="alert" style={styles.wingmanBody}>{failedWingman.message}</Text>
              <Pressable accessibilityRole="button" onPress={requestWingman} style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.retryText}>Thử lại với yêu cầu này</Text>
              </Pressable>
            </View>
          ) : wingmanSuggestions ? (
            <View style={styles.wingmanSuggestionList}>
              {wingmanSuggestions.map((suggestion, index) => (
                <Pressable
                  accessibilityHint="Chỉ điền vào ô soạn, không tự gửi"
                  accessibilityRole="button"
                  key={`${index}:${suggestion}`}
                  onPress={() => chooseSuggestion(suggestion)}
                  style={({ pressed }) => [styles.wingmanSuggestion, pressed && styles.pressed]}
                >
                  <Text style={styles.wingmanSuggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={requestWingman} style={({ pressed }) => [styles.wingmanRefresh, pressed && styles.pressed]}>
                <RefreshCw color={colors.primaryText} size={13} /><Text style={styles.wingmanRefreshText}>Tạo ba gợi ý khác</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={requestWingman} style={styles.wingmanPrimaryButton}>
              <Text style={styles.wingmanPrimaryText}>Gợi ý câu trả lời</Text>
            </Pressable>
          )}
          <Text style={styles.wingmanFootnote}>Chạm một gợi ý để điền vào ô soạn. Wingman không bao giờ tự gửi.</Text>
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Nhắn tin..."
          placeholderTextColor={colors.mutedLight}
          maxLength={4000}
          style={styles.input}
          onSubmitEditing={submit}
        />
        <Pressable onPress={submit} disabled={!content.trim() || mutation.isPending} style={styles.sendShadow}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendBtn}>
            <Send color={colors.onPrimary} size={18} />
          </LinearGradient>
        </Pressable>
      </View>

      <Modal animationType="fade" onRequestClose={() => setPendingSuggestion(null)} transparent visible={pendingSuggestion != null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}><Sparkles color={colors.primaryStrong} size={22} /></View>
            <Text style={styles.modalTitle}>Thay nội dung đang soạn?</Text>
            <Text style={styles.modalBody}>Wingman chỉ điền gợi ý vào composer và sẽ không tự gửi tin nhắn.</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPendingSuggestion(null)} style={[styles.modalButton, styles.modalCancel]}><Text style={styles.modalCancelText}>Giữ bản nháp</Text></Pressable>
              <Pressable onPress={() => { if (pendingSuggestion) setContent(pendingSuggestion); setPendingSuggestion(null); }} style={[styles.modalButton, styles.modalConfirm]}><Text style={styles.modalConfirmText}>Dùng gợi ý</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  backButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 15, height: 38, justifyContent: 'center', width: 38 },
  headerCopy: { flex: 1 },
  headerName: { fontWeight: '900', fontSize: 15, color: colors.text },
  headerStatusRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 2 },
  headerStatus: { fontSize: 10.5, color: colors.muted, fontWeight: '600' },
  wingmanHeaderButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceTint,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  wingmanHeaderButtonActive: { backgroundColor: colors.primaryStrong },
  pressed: { opacity: 0.75 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.muted, fontSize: 14, marginBottom: 10 },
  retryText: { color: colors.primaryStrong, fontSize: 14, fontWeight: '800' },
  messages: { padding: 18, paddingBottom: 26 },
  revealCard: {
    alignItems: 'center',
    backgroundColor: colors.noteBg,
    borderColor: colors.noteBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
    padding: 14,
  },
  revealTitle: { color: colors.text, fontSize: 13.5, fontWeight: '800', textAlign: 'center' },
  revealBody: { color: colors.noteText, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  revealButton: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 10 },
  revealButtonText: { color: colors.onPrimary, fontSize: 12.5, fontWeight: '800' },
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
  dayRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginVertical: 15 },
  dayLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dayText: { color: colors.muted, fontSize: 9.5, fontWeight: '700' },
  messageMine: { alignItems: 'flex-end', marginBottom: 9 },
  messageTheirs: { alignItems: 'flex-start', marginBottom: 9 },
  messageMeta: { color: colors.mutedLight, fontSize: 9.5, marginHorizontal: 4, marginTop: 4 },
  pendingBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 5, borderRadius: 18, opacity: 0.7 },
  sendError: { alignItems: 'flex-end', gap: 3, marginBottom: 8 },
  sendErrorText: { color: '#A7442E', fontSize: 10.5 },

  wingmanPanel: {
    backgroundColor: '#FFF8EF',
    borderColor: colors.noteBorder,
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  wingmanPanelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wingmanTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  wingmanTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  wingmanPrivate: { backgroundColor: colors.surfaceTint, borderRadius: radii.pill, color: colors.primaryText, fontSize: 9.5, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  wingmanBody: { color: colors.textSoft, flex: 1, fontSize: 12.5, lineHeight: 18 },
  wingmanLoading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  wingmanError: { gap: 7 },
  wingmanSuggestionList: { gap: 7 },
  wingmanSuggestion: {
    backgroundColor: colors.surface,
    borderColor: colors.noteBorder,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    shadowColor: '#B87843',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  wingmanSuggestionText: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  wingmanRefresh: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, paddingVertical: 3 },
  wingmanRefreshText: { color: colors.primaryText, fontSize: 12.5, fontWeight: '800' },
  wingmanPrimaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryStrong,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  wingmanPrimaryText: { color: colors.onPrimary, fontSize: 12.5, fontWeight: '800' },
  wingmanFootnote: { color: colors.muted, fontSize: 10.5, lineHeight: 15 },

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
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(43,33,26,0.48)', flex: 1, justifyContent: 'center', padding: 22 },
  modalCard: { backgroundColor: colors.surface, borderRadius: 25, gap: 10, maxWidth: 390, padding: 22, width: '100%' },
  modalIcon: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 20, height: 46, justifyContent: 'center', marginBottom: 3, width: 46 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  modalBody: { color: colors.textSoft, fontSize: 12.5, lineHeight: 19 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 8 },
  modalButton: { alignItems: 'center', borderRadius: 14, flex: 1, justifyContent: 'center', minHeight: 45, paddingHorizontal: 10 },
  modalCancel: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 },
  modalConfirm: { backgroundColor: colors.primaryStrong },
  modalCancelText: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
  modalConfirmText: { color: colors.onPrimary, fontSize: 11.5, fontWeight: '900' },
});
