import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { ChevronLeft, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { useAuth } from '@/providers/AuthProvider';
import {
  loadPreferenceChatMessages,
  preferenceChatQueryKey,
  preferenceProfileQueryKey,
  sendPreferenceChat,
} from '@/services/preferenceChat';
import { colors, radii } from '@/theme';

const MAX_CONTENT_LENGTH = 2_000;

type SendAttempt = {
  content: string;
  idempotencyKey: string;
  userId: string;
};

type FailedAttempt = {
  input: SendAttempt;
  message: string;
};

function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.()
    ?? `preference_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Chưa lưu được tùy chỉnh. Dữ liệu bạn nhập vẫn được giữ lại.';
}

export default function PreferenceChatScreen() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [content, setContent] = useState('');
  const [failedAttempt, setFailedAttempt] = useState<FailedAttempt | null>(null);

  const messagesKey = preferenceChatQueryKey(userId);
  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: () => loadPreferenceChatMessages(userId),
    enabled: Boolean(userId),
  });

  const mutation = useMutation({
    mutationFn: sendPreferenceChat,
    retry: false,
    onError: (error, input) => {
      if (input.userId !== userId) return;
      setFailedAttempt({ input, message: errorMessage(error) });
    },
    onSuccess: async (_result, input) => {
      if (input.userId === userId) {
        setFailedAttempt(previous => previous?.input.idempotencyKey === input.idempotencyKey ? null : previous);
        setContent(current => current.trim() === input.content ? '' : current);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: preferenceChatQueryKey(input.userId) }),
        queryClient.invalidateQueries({ queryKey: preferenceProfileQueryKey(input.userId) }),
      ]);
    },
  });

  useEffect(() => {
    setContent('');
    setFailedAttempt(null);
    mutation.reset();
    // Reset all local send state at the account boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const trimmed = content.trim();
  const isBlank = content.length > 0 && trimmed.length === 0;
  const isTooLong = content.length > MAX_CONTENT_LENGTH;
  const canSend = Boolean(userId && trimmed && !isTooLong && !mutation.isPending);

  const submit = () => {
    if (!canSend) return;
    const retryable = failedAttempt?.input.userId === userId && failedAttempt.input.content === trimmed
      ? failedAttempt.input
      : null;
    const input = retryable ?? { content: trimmed, idempotencyKey: newIdempotencyKey(), userId };
    if (!retryable) setFailedAttempt(null);
    mutation.mutate(input);
  };

  const retryFailed = () => {
    if (!failedAttempt || failedAttempt.input.userId !== userId || mutation.isPending) return;
    mutation.mutate(failedAttempt.input);
  };

  if (!isAuthLoading && !session) return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable accessibilityLabel="Quay lại" hitSlop={10} onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft color={colors.primaryText} size={25} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Tinh chỉnh AI Picks</Text>
            <Text style={styles.subtitle}>Nói thêm về gu của bạn, bất cứ lúc nào.</Text>
          </View>
          <View style={styles.sparkle}>
            <Sparkles color={colors.primaryText} size={19} />
          </View>
        </View>

        {isAuthLoading || messagesQuery.isLoading || !userId ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : messagesQuery.isError ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Chưa tải được cuộc trò chuyện</Text>
            <Text style={styles.stateBody}>{errorMessage(messagesQuery.error)}</Text>
            <Button variant="light" onPress={() => void messagesQuery.refetch()}>Thử lại</Button>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {(messagesQuery.data ?? []).length === 0 ? (
              <View style={styles.introCard}>
                <Text style={styles.introIcon}>✨</Text>
                <Text style={styles.introTitle}>Bạn muốn AI hiểu thêm điều gì?</Text>
                <Text style={styles.introBody}>
                  Ví dụ: “Mình thích người chủ động, giao tiếp rõ ràng và thường đi cà phê cuối tuần.”
                </Text>
              </View>
            ) : null}

            {(messagesQuery.data ?? []).map(message => (
              <View
                key={message.id}
                style={[
                  styles.message,
                  message.sender === 'user' ? styles.userMessage : styles.assistantMessage,
                ]}
              >
                {message.sender === 'assistant' ? <Text style={styles.messageLabel}>F-Love AI</Text> : null}
                <Text style={message.sender === 'user' ? styles.userMessageText : styles.assistantMessageText}>
                  {message.content}
                </Text>
              </View>
            ))}

            {failedAttempt ? (
              <View accessibilityRole="alert" style={styles.errorCard}>
                <Text style={styles.errorTitle}>Chưa lưu được thay đổi</Text>
                <Text numberOfLines={2} style={styles.failedContent}>“{failedAttempt.input.content}”</Text>
                <Text style={styles.errorBody}>{failedAttempt.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={mutation.isPending}
                  onPress={retryFailed}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retryText}>{mutation.isPending ? 'Đang thử lại…' : 'Thử gửi lại'}</Text>
                </Pressable>
              </View>
            ) : null}
          </ScrollView>
        )}

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Nội dung tinh chỉnh AI Picks"
            editable={Boolean(userId)}
            maxLength={MAX_CONTENT_LENGTH}
            multiline
            onChangeText={setContent}
            onSubmitEditing={submit}
            placeholder="Mô tả thêm về người bạn muốn gặp…"
            placeholderTextColor={colors.mutedLight}
            style={styles.input}
            textAlignVertical="top"
            value={content}
          />
          <View style={styles.composerFooter}>
            <View style={styles.validationCopy}>
              {isBlank ? <Text style={styles.validationError}>Nội dung không thể chỉ có khoảng trắng.</Text> : null}
              <Text style={[styles.count, content.length >= 1_800 && styles.countWarning]}>
                {content.length}/{MAX_CONTENT_LENGTH}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Gửi tùy chỉnh"
              accessibilityRole="button"
              disabled={!canSend}
              onPress={submit}
              style={({ pressed }) => [
                styles.sendButton,
                !canSend && styles.sendDisabled,
                pressed && canSend && styles.pressed,
              ]}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Send color={colors.onPrimary} size={18} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  keyboard: { flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
  sparkle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceTint,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  centerState: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 28 },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  stateBody: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  thread: { flex: 1 },
  threadContent: { flexGrow: 1, gap: 10, justifyContent: 'flex-end', padding: 18 },
  introCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.noteBorder,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: 8,
    padding: 22,
  },
  introIcon: { fontSize: 30 },
  introTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  introBody: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginTop: 7, textAlign: 'center' },
  message: { maxWidth: '84%', paddingHorizontal: 14, paddingVertical: 11 },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primaryStrong,
    borderBottomRightRadius: 5,
    borderRadius: 18,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 5,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
  },
  messageLabel: { color: colors.primaryText, fontSize: 10.5, fontWeight: '800', marginBottom: 4 },
  userMessageText: { color: colors.onPrimary, fontSize: 14, lineHeight: 20 },
  assistantMessageText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  errorCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.accent,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 6,
    marginTop: 6,
    padding: 14,
  },
  errorTitle: { color: colors.text, fontSize: 13.5, fontWeight: '800' },
  failedContent: { color: colors.textSoft, fontSize: 12.5, lineHeight: 18 },
  errorBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', marginTop: 3, paddingVertical: 5 },
  retryText: { color: colors.primaryText, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.78 },
  composer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 14,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 132,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  composerFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  validationCopy: { flex: 1, gap: 2 },
  validationError: { color: colors.accent, fontSize: 11.5 },
  count: { color: colors.muted, fontSize: 11.5 },
  countWarning: { color: colors.warning, fontWeight: '700' },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryStrong,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  sendDisabled: { opacity: 0.45 },
});
