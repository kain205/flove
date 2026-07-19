import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, ExternalLink, Heart, Lightbulb, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/Button';
import { useAuth } from '@/providers/AuthProvider';
import {
  enrollInFreeCourse,
  finishLearningLesson,
  learningCourseQueryKey,
  learningCoursesQueryKey,
  loadLearningCourse,
  newCourseEnrollmentRequestId,
} from '@/services/courses';
import { colors, gradients, radii } from '@/theme';

export default function CourseDetailScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const [lessonIndex, setLessonIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [reflection, setReflection] = useState('');
  const [completionFeedback, setCompletionFeedback] = useState<{ correct: boolean; lessonId: string } | null>(null);
  const enrollmentRequestRef = useRef<string | null>(null);
  const query = useQuery({
    queryKey: learningCourseQueryKey(userId, slug),
    queryFn: () => loadLearningCourse(slug),
    enabled: Boolean(userId && slug),
  });

  useEffect(() => {
    const course = query.data;
    if (!course?.enrollment) return;
    const target = Math.max(0, Math.min(course.lessons.length - 1, course.enrollment.currentLesson - 1));
    setLessonIndex(current => course.lessons[current]?.progress == null ? target : current);
  }, [query.data]);

  const enrollment = useMutation({
    mutationFn: (courseId: string) => {
      enrollmentRequestRef.current ??= newCourseEnrollmentRequestId();
      return enrollInFreeCourse(courseId, enrollmentRequestRef.current);
    },
    onSuccess: async () => {
      enrollmentRequestRef.current = null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: learningCourseQueryKey(userId, slug) }),
        queryClient.invalidateQueries({ queryKey: learningCoursesQueryKey(userId) }),
      ]);
    },
  });

  const completion = useMutation({
    mutationFn: (input: { courseId: string; lessonId: string; selectedAnswer: number; reflection: string }) => finishLearningLesson(input),
    onSuccess: async result => {
      setCompletionFeedback({ correct: result.isCorrect, lessonId: result.lessonId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: learningCourseQueryKey(userId, slug) }),
        queryClient.invalidateQueries({ queryKey: learningCoursesQueryKey(userId) }),
      ]);
    },
  });

  const course = query.data;
  const lesson = course?.lessons[lessonIndex];
  const completed = Boolean(lesson?.progress || completionFeedback?.lessonId === lesson?.id);

  const goToLesson = (index: number) => {
    setLessonIndex(index);
    setSelectedAnswer(null);
    setReflection('');
    setCompletionFeedback(null);
  };

  if (query.isLoading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Đang mở bài học…</Text></View></SafeAreaView>;
  }
  if (query.isError || !course || !lesson) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Chưa mở được khóa học</Text>
          <Text style={styles.muted}>{query.error instanceof Error ? query.error.message : 'Nội dung chưa khả dụng.'}</Text>
          <Button variant="secondary" onPress={() => router.back()}>Quay lại</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!course.enrollment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.enrollGate}>
          <View style={styles.gateIcon}><Heart color={colors.primaryStrong} fill={colors.primaryStrong} size={27} /></View>
          <Text style={styles.gateTitle}>{course.title}</Text>
          <Text style={styles.gateBody}>Đăng ký miễn phí để lưu tiến độ và bắt đầu bốn bài học riêng tư.</Text>
          {enrollment.isError ? <Text style={styles.inlineError}>{enrollment.error instanceof Error ? enrollment.error.message : 'Vui lòng thử lại.'}</Text> : null}
          <Button disabled={enrollment.isPending} onPress={() => enrollment.mutate(course.id)}>{enrollment.isPending ? 'Đang đăng ký…' : 'Đăng ký miễn phí'}</Button>
          <Pressable onPress={() => router.back()}><Text style={styles.backText}>Để sau</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Quay lại" hitSlop={8} onPress={() => router.back()} style={styles.iconButton}><ArrowLeft color={colors.text} size={20} /></Pressable>
        <View style={styles.topbarCopy}><Text style={styles.topbarEyebrow}>YÊU LÀNH MẠNH 101</Text><Text style={styles.topbarTitle} numberOfLines={1}>{lesson.title}</Text></View>
        <Text style={styles.stepText}>{lesson.position}/{course.lessonCount}</Text>
      </View>
      <View style={styles.progressTrack}><LinearGradient colors={gradients.brand} style={[styles.progressFill, { width: `${Math.max(course.enrollment.progressPercent, ((lesson.position - 1) / course.lessonCount) * 100)}%` }]} /></View>

      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {course.enrollment.status === 'completed' ? (
          <LinearGradient colors={['#FFF0D8', '#FFE4D2']} style={styles.completedBanner}>
            <View style={styles.completedIcon}><Check color={colors.onPrimary} size={17} /></View>
            <View style={{ flex: 1 }}><Text style={styles.completedTitle}>Bạn đã hoàn thành khóa học</Text><Text style={styles.completedBody}>Quay lại bất kỳ bài nào khi bạn cần một lời nhắc nhẹ.</Text></View>
          </LinearGradient>
        ) : null}

        <View style={styles.lessonHero}>
          <View style={styles.lessonMeta}><Text style={styles.lessonEyebrow}>{lesson.eyebrow}</Text><View style={styles.duration}><Clock3 color={colors.primaryText} size={13} /><Text style={styles.durationText}>{lesson.durationMinutes} phút</Text></View></View>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.lessonSummary}>{lesson.summary}</Text>
        </View>

        {lesson.contentBlocks.map((block, index) => (
          <View key={`${lesson.id}-${index}`} style={[styles.block, block.kind === 'safety' && styles.safetyBlock, block.kind === 'lead' && styles.leadBlock]}>
            <View style={styles.blockTitleRow}>
              {block.kind === 'safety' ? <ShieldCheck color={colors.noteText} size={18} /> : block.kind === 'scenario' || block.kind === 'practice' ? <Lightbulb color={colors.primaryStrong} size={18} /> : <Sparkles color={colors.primary} size={16} />}
              <Text style={styles.blockTitle}>{block.title}</Text>
            </View>
            {block.body ? <Text style={styles.blockBody}>{block.body}</Text> : null}
            {block.items?.map((item, itemIndex) => (
              <View key={`${index}-${itemIndex}`} style={styles.bulletRow}><View style={styles.bullet}><Text style={styles.bulletText}>{itemIndex + 1}</Text></View><Text style={styles.bulletBody}>{item}</Text></View>
            ))}
          </View>
        ))}

        <View style={styles.quizCard}>
          <Text style={styles.quizEyebrow}>KIỂM TRA NHANH</Text>
          <Text style={styles.quizQuestion}>{lesson.quiz.question}</Text>
          <View style={styles.options}>
            {lesson.quiz.options.map((option, index) => {
              const saved = lesson.progress?.selectedAnswer === index;
              const selected = selectedAnswer === index || (selectedAnswer == null && saved);
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: completed }}
                  disabled={completed}
                  key={option}
                  onPress={() => setSelectedAnswer(index)}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {completed ? (
            <View style={styles.explanation}>
              <CheckCircle2 color={completionFeedback?.correct === false || lesson.progress?.isCorrect === false ? colors.warning : colors.online} size={18} />
              <Text style={styles.explanationText}>{lesson.quiz.explanation}</Text>
            </View>
          ) : null}
        </View>

        {!completed ? (
          <View style={styles.reflectionCard}>
            <Text style={styles.reflectionTitle}>Một dòng cho riêng bạn</Text>
            <Text style={styles.reflectionHint}>Bạn muốn nhớ điều gì sau bài này? Nội dung này không được gửi cho AI hoặc người khác.</Text>
            <TextInput
              maxLength={1000}
              multiline
              onChangeText={setReflection}
              placeholder="Ví dụ: Mình có quyền nói rõ nhịp độ khiến mình thoải mái…"
              placeholderTextColor={colors.mutedLight}
              style={styles.reflectionInput}
              value={reflection}
            />
          </View>
        ) : null}

        {completion.isError ? <Text accessibilityRole="alert" style={styles.inlineError}>{completion.error instanceof Error ? completion.error.message : 'Chưa lưu được tiến độ.'}</Text> : null}

        {completed ? (
          lessonIndex < course.lessons.length - 1 ? (
            <Button onPress={() => goToLesson(lessonIndex + 1)}>Bài tiếp theo</Button>
          ) : (
            <Button onPress={() => router.replace('/course')}>Hoàn tất hành trình</Button>
          )
        ) : (
          <Button
            disabled={selectedAnswer == null || completion.isPending}
            onPress={() => selectedAnswer != null && completion.mutate({ courseId: course.id, lessonId: lesson.id, selectedAnswer, reflection })}
          >
            {completion.isPending ? 'Đang lưu…' : 'Hoàn thành bài học'}
          </Button>
        )}

        <View style={styles.lessonNav}>
          {course.lessons.map((item, index) => (
            <Pressable key={item.id} onPress={() => goToLesson(index)} style={[styles.lessonDot, index === lessonIndex && styles.lessonDotActive, item.progress && styles.lessonDotDone]}>
              {item.progress ? <Check color={index === lessonIndex ? colors.onPrimary : colors.primaryStrong} size={13} /> : <Text style={[styles.lessonDotText, index === lessonIndex && styles.lessonDotTextActive]}>{item.position}</Text>}
            </Pressable>
          ))}
        </View>

        <View style={styles.sources}>
          <Text style={styles.sourcesTitle}>Học sâu hơn từ nguồn chính thức</Text>
          {course.sourceLinks.map(link => (
            <Pressable key={link.url} onPress={() => void Linking.openURL(link.url)} style={styles.sourceLink}>
              <Text numberOfLines={2} style={styles.sourceText}>{link.label}</Text><ExternalLink color={colors.primaryText} size={15} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  center: { alignItems: 'center', flex: 1, gap: 14, justifyContent: 'center', padding: 28 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  topbar: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingHorizontal: 16, paddingVertical: 10 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  topbarCopy: { flex: 1 },
  topbarEyebrow: { color: colors.primaryText, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  topbarTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  stepText: { color: colors.primaryText, fontSize: 12, fontWeight: '900' },
  progressTrack: { backgroundColor: colors.surfaceTint, height: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },
  page: { gap: 14, padding: 18, paddingBottom: 60 },
  completedBanner: { alignItems: 'center', borderRadius: 19, flexDirection: 'row', gap: 11, padding: 14 },
  completedIcon: { alignItems: 'center', backgroundColor: colors.primaryStrong, borderRadius: 14, height: 32, justifyContent: 'center', width: 32 },
  completedTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  completedBody: { color: colors.textSoft, fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  lessonHero: { paddingHorizontal: 4, paddingVertical: 9 },
  lessonMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lessonEyebrow: { color: colors.primaryText, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.4 },
  duration: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  durationText: { color: colors.muted, fontSize: 10.5, fontWeight: '700' },
  lessonTitle: { color: colors.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.8, lineHeight: 32, marginTop: 10 },
  lessonSummary: { color: colors.textSoft, fontSize: 13, lineHeight: 20, marginTop: 8 },
  block: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 21, borderWidth: 1, gap: 10, padding: 17 },
  leadBlock: { backgroundColor: '#FFFBF6' },
  safetyBlock: { backgroundColor: colors.noteBg, borderColor: colors.noteBorder },
  blockTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  blockTitle: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '900' },
  blockBody: { color: colors.textSoft, fontSize: 12.5, lineHeight: 20 },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  bullet: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 10, height: 22, justifyContent: 'center', marginTop: 1, width: 22 },
  bulletText: { color: colors.primaryText, fontSize: 9.5, fontWeight: '900' },
  bulletBody: { color: colors.textSoft, flex: 1, fontSize: 12, lineHeight: 18 },
  quizCard: { backgroundColor: '#2F251F', borderRadius: 24, gap: 14, padding: 19 },
  quizEyebrow: { color: '#F8B76F', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  quizQuestion: { color: colors.onPrimary, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  options: { gap: 8 },
  option: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 10, padding: 12 },
  optionSelected: { backgroundColor: 'rgba(248,146,51,0.18)', borderColor: '#F89233' },
  radio: { alignItems: 'center', borderColor: 'rgba(255,255,255,0.45)', borderRadius: 9, borderWidth: 1.5, height: 18, justifyContent: 'center', width: 18 },
  radioSelected: { borderColor: '#F9A93C' },
  radioDot: { backgroundColor: '#F9A93C', borderRadius: 5, height: 8, width: 8 },
  optionText: { color: 'rgba(255,255,255,0.78)', flex: 1, fontSize: 12, lineHeight: 17 },
  optionTextSelected: { color: colors.onPrimary, fontWeight: '700' },
  explanation: { alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, flexDirection: 'row', gap: 8, padding: 11 },
  explanationText: { color: 'rgba(255,255,255,0.82)', flex: 1, fontSize: 11, lineHeight: 16 },
  reflectionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 6, padding: 16 },
  reflectionTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  reflectionHint: { color: colors.muted, fontSize: 10.5, lineHeight: 15 },
  reflectionInput: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 12.5, lineHeight: 18, marginTop: 5, minHeight: 82, padding: 12, textAlignVertical: 'top' },
  inlineError: { color: '#A7442E', fontSize: 12, lineHeight: 17 },
  lessonNav: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', marginTop: 4 },
  lessonDot: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 17, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  lessonDotActive: { backgroundColor: colors.primaryStrong, borderColor: colors.primaryStrong },
  lessonDotDone: { borderColor: colors.primary },
  lessonDotText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  lessonDotTextActive: { color: colors.onPrimary },
  sources: { borderTopColor: colors.border, borderTopWidth: 1, gap: 7, marginTop: 8, paddingTop: 18 },
  sourcesTitle: { color: colors.textSoft, fontSize: 11.5, fontWeight: '800' },
  sourceLink: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between', paddingVertical: 6 },
  sourceText: { color: colors.primaryText, flex: 1, fontSize: 11.5, lineHeight: 16 },
  enrollGate: { alignSelf: 'center', gap: 15, justifyContent: 'center', maxWidth: 420, padding: 28, width: '100%' },
  gateIcon: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surfaceTint, borderRadius: 25, height: 62, justifyContent: 'center', width: 62 },
  gateTitle: { color: colors.text, fontSize: 25, fontWeight: '900', textAlign: 'center' },
  gateBody: { color: colors.textSoft, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  backText: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
