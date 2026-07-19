import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  getBlindDateSession,
  getBlindDateSessionForConversation,
  listConversationMessages,
  markConversationRead,
  requestBlindDateReveal,
  type ConversationMessage,
} from '@flove/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  askConversationWingman,
  newWingmanRequestId,
  type WingmanRequest,
} from '@/services/wingman';
import { colors, gradients, radii } from '@/theme';

async function loadMessages(conversationId: string) {
  return listConversationMessages(supabase, conversationId);
}

async function sendMessage(conversationId: string, content: string, clientMessageId: string, expectedUserId: string) {
  const { error } = await supabase.rpc('send_message_atomic', {
    p_conversation_id: conversationId,
    p_content: content,
    p_client_message_id: clientMessageId,
    p_expected_user_id: expectedUserId,
  });
  if (error) throw error;
}

function messageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
  const pendingSendRef = useRef<{ content: string; clientMessageId: string; userId: string } | null>(null);
  const markedReadVersionRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const blindSessionQueryKey = ['blind-date-session', myId, blindSessionId ?? `conversation:${conversationId}`] as const;

  useEffect(() => {
    setContent('');
    setWingmanOpen(false);
    setWingmanSuggestions(null);
    setFailedWingman(null);
    pendingSendRef.current = null;
    markedReadVersionRef.current = null;
  }, [conversationId, myId]);

  const query = useQuery({
    queryKey: ['messages', myId, conversationId],
    queryFn: () => loadMessages(conversationId),
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
    void markConversationRead(supabase, conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ['conversations', myId] }))
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
      sendMessage(conversationId, input.content, input.clientMessageId, input.userId),
    onSuccess: (_result, input) => {
      if (input.userId !== myId) return;
      pendingSendRef.current = null;
      setContent('');
      setWingmanOpen(false);
      setWingmanSuggestions(null);
      setFailedWingman(null);
      void queryClient.invalidateQueries({ queryKey: ['messages', myId, conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['conversations', myId] });
    },
    onError: (error, input) => {
      if (input.userId !== myId) return;
      Alert.alert('Chưa gửi được tin nhắn', error instanceof Error ? error.message : 'Vui lòng thử lại.');
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
    const apply = () => setContent(suggestion);
    if (content.trim() && content.trim() !== suggestion) {
      Alert.alert(
        'Thay nội dung đang soạn?',
        'Gợi ý chỉ được điền vào ô soạn và sẽ không tự gửi.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Thay nội dung', onPress: apply },
        ],
      );
      return;
    }
    apply();
  };

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed || mutation.isPending) return;
    const pending = pendingSendRef.current;
    if (!myId) return;
    const input = pending?.content === trimmed && pending.userId === myId
      ? pending
      : { content: trimmed, clientMessageId: messageId(), userId: myId };
    pendingSendRef.current = input;
    mutation.mutate(input);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Avatar name="Match" size={42} />
        <View style={styles.headerCopy}>
          <Text style={styles.headerName}>Cuộc trò chuyện</Text>
          <Text style={styles.headerStatus}>● Đang hoạt động</Text>
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
          {(query.data ?? []).map((message: ConversationMessage) => {
            return message.isMine ? (
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
                <Text style={styles.wingmanRefreshText}>Tạo ba gợi ý khác</Text>
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
  headerCopy: { flex: 1 },
  headerName: { fontWeight: '700', fontSize: 15, color: colors.text },
  headerStatus: { fontSize: 11.5, color: colors.online, fontWeight: '600', marginTop: 1 },
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
  messages: { padding: 18, gap: 10 },
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

  wingmanPanel: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.noteBorder,
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  wingmanPanelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  wingmanTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  wingmanTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  wingmanPrivate: { color: colors.primaryText, fontSize: 11.5, fontWeight: '700' },
  wingmanBody: { color: colors.textSoft, flex: 1, fontSize: 12.5, lineHeight: 18 },
  wingmanLoading: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  wingmanError: { gap: 7 },
  wingmanSuggestionList: { gap: 7 },
  wingmanSuggestion: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wingmanSuggestionText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  wingmanRefresh: { alignSelf: 'flex-start', paddingVertical: 3 },
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
  sendText: { color: colors.onPrimary, fontSize: 18 },
});
