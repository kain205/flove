import { router } from 'expo-router';
import { ChevronLeft, Send, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/Avatar';
import { colors, gradients, radii } from '@/theme';

type TutorialMessage = { id: string; mine: boolean; content: string; status?: string };

const INITIAL_MESSAGES: TutorialMessage[] = [
  { id: 'guide-1', mine: false, content: 'Chào bạn 👋 Đây là cuộc trò chuyện mẫu để bạn làm quen với F-Love.' },
  { id: 'self-1', mine: true, content: 'Mình nên bắt đầu câu chuyện thế nào nhỉ?', status: 'Đã xem' },
  { id: 'guide-2', mine: false, content: 'Bạn có thể hỏi về một sở thích trong hồ sơ. Nếu bí ý tưởng, mở Wingman để nhận đúng 3 gợi ý riêng tư.' },
];

const SUGGESTIONS = [
  'Cuối tuần lý tưởng của bạn thường trông như thế nào?',
  'Mình thấy bạn thích cà phê, bạn có quán ruột nào không?',
  'Điều gì gần đây làm bạn vui nhất?',
];

export default function ChatTutorialScreen() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const applySuggestion = (suggestion: string) => {
    const replace = () => setDraft(suggestion);
    if (!draft.trim()) {
      replace();
      return;
    }
    Alert.alert('Thay nội dung đang viết?', 'Wingman chỉ điền ô soạn thảo và không tự gửi.', [
      { text: 'Giữ lại', style: 'cancel' },
      { text: 'Thay bằng gợi ý', onPress: replace },
    ]);
  };

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setMessages(current => [...current, { id: `self-${Date.now()}`, mine: true, content, status: 'Đã gửi' }]);
    setDraft('');
    timerRef.current = setTimeout(() => {
      setMessages(current => [...current, {
        id: `guide-${Date.now()}`,
        mine: false,
        content: 'Tuyệt! Trong chat thật, chỉ khi bạn bấm Gửi thì người kia mới thấy nội dung. Wingman luôn là công cụ riêng tư của bạn.',
      }]);
    }, 450);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <View style={styles.headerOuter}>
          <View style={styles.header}>
            <Pressable accessibilityLabel="Quay lại" hitSlop={8} onPress={() => router.back()} style={styles.iconButton}>
              <ChevronLeft color={colors.text} size={23} />
            </Pressable>
            <Avatar name="Mai" size={42} />
            <View style={styles.headerCopy}>
              <View style={styles.nameRow}><Text style={styles.name}>Mai</Text><Text style={styles.demoPill}>HƯỚNG DẪN</Text></View>
              <Text style={styles.headerHint}>Cuộc trò chuyện mẫu</Text>
            </View>
            <Sparkles color={colors.primaryStrong} size={19} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.threadOuter}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.thread}>
            <View style={styles.demoNotice}>
              <ShieldCheck color={colors.noteText} size={17} />
              <Text style={styles.demoNoticeText}>Dữ liệu mẫu để học cách dùng chat. Mai không phải người dùng thật và nội dung không được gửi lên server.</Text>
            </View>
            {messages.map(message => (
              <View key={message.id} style={message.mine ? styles.mineWrap : styles.theirsWrap}>
                <View style={[styles.bubble, message.mine ? styles.mine : styles.theirs]}>
                  <Text style={message.mine ? styles.mineText : styles.theirsText}>{message.content}</Text>
                </View>
                {message.status ? <Text style={styles.status}>{message.status}</Text> : null}
              </View>
            ))}

            <View style={styles.wingman}>
              <View style={styles.wingmanHead}><Sparkles color={colors.primaryStrong} size={16} /><Text style={styles.wingmanTitle}>Wingman mẫu</Text></View>
              <Text style={styles.wingmanBody}>Chạm một câu để điền ô soạn thảo. Không gợi ý nào được tự động gửi.</Text>
              {SUGGESTIONS.map((suggestion, index) => (
                <Pressable key={suggestion} onPress={() => applySuggestion(suggestion)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                  <Text style={styles.suggestionNumber}>0{index + 1}</Text><Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.composerOuter}>
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Tin nhắn hướng dẫn"
              maxLength={4000}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              placeholder="Thử viết hoặc chọn một gợi ý…"
              placeholderTextColor={colors.mutedLight}
              style={styles.input}
              value={draft}
            />
            <Pressable accessibilityLabel="Gửi tin nhắn mẫu" disabled={!draft.trim()} onPress={submit} style={!draft.trim() && styles.disabled}>
              <LinearGradient colors={gradients.brand} style={styles.send}><Send color={colors.onPrimary} size={17} /></LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  keyboard: { flex: 1 },
  headerOuter: { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 },
  header: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 10, maxWidth: 780, paddingHorizontal: 15, paddingVertical: 10, width: '100%' },
  iconButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 34 },
  headerCopy: { flex: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  name: { color: colors.text, fontSize: 15, fontWeight: '900' },
  demoPill: { backgroundColor: colors.surfaceTint, borderRadius: radii.pill, color: colors.primaryText, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7, paddingHorizontal: 7, paddingVertical: 4 },
  headerHint: { color: colors.muted, fontSize: 10, marginTop: 2 },
  threadOuter: { alignItems: 'center', flexGrow: 1, justifyContent: 'flex-end', padding: 16 },
  thread: { gap: 9, maxWidth: 740, width: '100%' },
  demoNotice: { alignItems: 'flex-start', backgroundColor: colors.noteBg, borderColor: colors.noteBorder, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 5, padding: 12 },
  demoNoticeText: { color: colors.noteText, flex: 1, fontSize: 11, lineHeight: 16 },
  mineWrap: { alignItems: 'flex-end' },
  theirsWrap: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 10 },
  mine: { backgroundColor: colors.primaryStrong, borderBottomRightRadius: 5, borderRadius: 18 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 5, borderColor: colors.border, borderRadius: 18, borderWidth: 1 },
  mineText: { color: colors.onPrimary, fontSize: 13, lineHeight: 19 },
  theirsText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  status: { color: colors.mutedLight, fontSize: 8.5, marginHorizontal: 4, marginTop: 3 },
  wingman: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 21, borderWidth: 1, gap: 8, marginTop: 10, padding: 15 },
  wingmanHead: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  wingmanTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  wingmanBody: { color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  suggestion: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 9, padding: 11 },
  suggestionNumber: { color: colors.primaryText, fontSize: 9, fontWeight: '900' },
  suggestionText: { color: colors.textSoft, flex: 1, fontSize: 11.5, lineHeight: 16 },
  pressed: { opacity: 0.75 },
  composerOuter: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, padding: 10 },
  composer: { alignItems: 'center', alignSelf: 'center', flexDirection: 'row', gap: 9, maxWidth: 740, width: '100%' },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, color: colors.text, flex: 1, fontSize: 12.5, minHeight: 43, paddingHorizontal: 15, paddingVertical: 10 },
  send: { alignItems: 'center', borderRadius: 22, height: 43, justifyContent: 'center', width: 43 },
  disabled: { opacity: 0.4 },
});
