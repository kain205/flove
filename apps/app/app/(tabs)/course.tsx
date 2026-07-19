import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { BookOpen, CheckCircle2, Clock3, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useRef } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/Button';
import { useAuth } from '@/providers/AuthProvider';
import {
  enrollInFreeCourse,
  learningCoursesQueryKey,
  loadLearningCourses,
  newCourseEnrollmentRequestId,
} from '@/services/courses';
import { colors, gradients, radii } from '@/theme';

export default function CourseHomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const requestIdRef = useRef<string | null>(null);
  const query = useQuery({
    queryKey: learningCoursesQueryKey(userId),
    queryFn: loadLearningCourses,
    enabled: Boolean(userId),
  });
  const enrollment = useMutation({
    mutationFn: (courseId: string) => {
      requestIdRef.current ??= newCourseEnrollmentRequestId();
      return enrollInFreeCourse(courseId, requestIdRef.current);
    },
    onSuccess: async (_result, courseId) => {
      const course = query.data?.find(item => item.id === courseId);
      requestIdRef.current = null;
      await queryClient.invalidateQueries({ queryKey: learningCoursesQueryKey(userId) });
      if (course) router.push(`/course/${course.slug}`);
    },
  });

  const course = query.data?.[0];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>F-LOVE LEARNING</Text>
            <Text style={styles.pageTitle}>Học để yêu tử tế hơn</Text>
          </View>
          <View style={styles.headerIcon}><HeartHandshake color={colors.primaryStrong} size={22} /></View>
        </View>

        <LinearGradient colors={gradients.heroCard} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }} style={styles.hero}>
          <View style={styles.glowOne} />
          <View style={styles.glowTwo} />
          <View style={styles.freePill}>
            <Sparkles color={colors.primaryDeep} size={13} />
            <Text style={styles.freePillText}>KHÓA ĐẦU TIÊN · MIỄN PHÍ</Text>
          </View>
          <Text style={styles.heroTitle}>Yêu lành mạnh{`\n`}bắt đầu từ hiểu mình.</Text>
          <Text style={styles.heroBody}>
            Một hành trình ngắn, thực tế và riêng tư để bạn nhận diện tín hiệu tốt, nói rõ ranh giới và trò chuyện tự tin hơn.
          </Text>
          <View style={styles.heroMeta}>
            <View style={styles.heroMetaItem}><Clock3 color={colors.onPrimary} size={16} /><Text style={styles.heroMetaText}>24 phút</Text></View>
            <View style={styles.heroMetaDivider} />
            <View style={styles.heroMetaItem}><BookOpen color={colors.onPrimary} size={16} /><Text style={styles.heroMetaText}>4 bài ngắn</Text></View>
          </View>
        </LinearGradient>

        {query.isLoading ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Đang chuẩn bị khóa học…</Text></View>
        ) : query.isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Chưa tải được khóa học</Text>
            <Text style={styles.errorBody}>{query.error instanceof Error ? query.error.message : 'Vui lòng thử lại.'}</Text>
            <Pressable onPress={() => void query.refetch()}><Text style={styles.retry}>Thử lại</Text></Pressable>
          </View>
        ) : course ? (
          <View style={styles.courseCard}>
            <View style={styles.courseTop}>
              <View style={styles.courseIcon}><ShieldCheck color={colors.primaryStrong} size={23} /></View>
              <View style={styles.courseCopy}>
                <Text style={styles.courseTitle}>{course.title}</Text>
                <Text style={styles.courseSubtitle}>{course.subtitle}</Text>
              </View>
              {course.enrollmentStatus === 'completed' ? <CheckCircle2 color={colors.online} size={23} /> : null}
            </View>

            {course.enrollmentStatus ? (
              <View style={styles.progressWrap}>
                <View style={styles.progressHead}>
                  <Text style={styles.progressLabel}>{course.enrollmentStatus === 'completed' ? 'Đã hoàn thành' : `Bài ${course.currentLesson}/${course.lessonCount}`}</Text>
                  <Text style={styles.progressValue}>{course.progressPercent}%</Text>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${course.progressPercent}%` }]} /></View>
              </View>
            ) : (
              <View style={styles.promiseRow}>
                <CheckCircle2 color={colors.primary} size={17} /><Text style={styles.promise}>Không thẻ thanh toán</Text>
                <CheckCircle2 color={colors.primary} size={17} /><Text style={styles.promise}>Tiến độ riêng tư</Text>
              </View>
            )}

            {enrollment.isError ? (
              <Text accessibilityRole="alert" style={styles.inlineError}>
                {enrollment.error instanceof Error ? enrollment.error.message : 'Chưa đăng ký được. Vui lòng thử lại.'}
              </Text>
            ) : null}

            {course.enrollmentStatus ? (
              <Button onPress={() => router.push(`/course/${course.slug}`)}>
                {course.enrollmentStatus === 'completed' ? 'Xem lại khóa học' : 'Tiếp tục học'}
              </Button>
            ) : (
              <Button disabled={enrollment.isPending} onPress={() => enrollment.mutate(course.id)}>
                {enrollment.isPending ? 'Đang đăng ký…' : 'Đăng ký miễn phí'}
              </Button>
            )}
          </View>
        ) : (
          <View style={styles.state}><Text style={styles.stateText}>Khóa học đầu tiên sắp mở.</Text></View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>BẠN SẼ MANG THEO</Text>
          <Text style={styles.sectionTitle}>Những kỹ năng dùng được ngay</Text>
          <View style={styles.outcomes}>
            {[
              ['01', 'Nhận diện', 'Phân biệt quan tâm, tôn trọng và những hành vi kiểm soát.'],
              ['02', 'Ranh giới', 'Nói rõ điều bạn cần mà không biến nó thành tối hậu thư.'],
              ['03', 'Giao tiếp', 'Lắng nghe nhu cầu và xử lý bất đồng không làm tổn thương nhau.'],
              ['04', 'An toàn', 'Giữ quyền riêng tư và chủ động trong buổi hẹn đầu.'],
            ].map(([number, title, body]) => (
              <View key={number} style={styles.outcome}>
                <Text style={styles.outcomeNumber}>{number}</Text>
                <View style={styles.outcomeCopy}><Text style={styles.outcomeTitle}>{title}</Text><Text style={styles.outcomeBody}>{body}</Text></View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.disclaimer}>
          <ShieldCheck color={colors.noteText} size={18} />
          <Text style={styles.disclaimerText}>Nội dung mang tính giáo dục, không thay thế tư vấn tâm lý, y tế hoặc hỗ trợ khẩn cấp.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  page: { gap: 18, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 110 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 },
  kicker: { color: colors.primaryText, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 4 },
  headerIcon: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 18, height: 42, justifyContent: 'center', width: 42 },
  hero: { borderRadius: 30, minHeight: 294, overflow: 'hidden', padding: 25 },
  glowOne: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 90, height: 180, position: 'absolute', right: -55, top: -60, width: 180 },
  glowTwo: { backgroundColor: 'rgba(255,240,210,0.13)', borderRadius: 80, bottom: -80, height: 160, left: -35, position: 'absolute', width: 160 },
  freePill: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  freePillText: { color: colors.primaryDeep, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: colors.onPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 35, marginTop: 24 },
  heroBody: { color: 'rgba(255,255,255,0.9)', fontSize: 13.5, lineHeight: 21, marginTop: 12, maxWidth: 330 },
  heroMeta: { alignItems: 'center', flexDirection: 'row', marginTop: 22 },
  heroMetaItem: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  heroMetaText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
  heroMetaDivider: { backgroundColor: 'rgba(255,255,255,0.35)', height: 17, marginHorizontal: 13, width: 1 },
  state: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, gap: 10, padding: 28 },
  stateText: { color: colors.muted, fontSize: 13 },
  errorCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, gap: 7, padding: 20 },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  errorBody: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  retry: { color: colors.primaryText, fontSize: 13, fontWeight: '800', marginTop: 3 },
  courseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 25, borderWidth: 1, gap: 18, padding: 19, shadowColor: '#B87843', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 22 },
  courseTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  courseIcon: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  courseCopy: { flex: 1 },
  courseTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  courseSubtitle: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  promiseRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  promise: { color: colors.textSoft, fontSize: 11.5, marginRight: 8 },
  progressWrap: { gap: 7 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: colors.textSoft, fontSize: 11.5, fontWeight: '700' },
  progressValue: { color: colors.primaryText, fontSize: 11.5, fontWeight: '900' },
  track: { backgroundColor: colors.surfaceTint, borderRadius: radii.pill, height: 8, overflow: 'hidden' },
  fill: { backgroundColor: colors.primaryStrong, borderRadius: radii.pill, height: '100%' },
  inlineError: { color: '#A7442E', fontSize: 12, lineHeight: 17 },
  section: { paddingTop: 5 },
  sectionEyebrow: { color: colors.primaryText, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.6 },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.4, marginTop: 5 },
  outcomes: { gap: 9, marginTop: 14 },
  outcome: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 13, padding: 14 },
  outcomeNumber: { color: colors.primaryStrong, fontSize: 11, fontWeight: '900', paddingTop: 2 },
  outcomeCopy: { flex: 1 },
  outcomeTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  outcomeBody: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  disclaimer: { alignItems: 'flex-start', backgroundColor: colors.noteBg, borderColor: colors.noteBorder, borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 9, padding: 14 },
  disclaimerText: { color: colors.noteText, flex: 1, fontSize: 11, lineHeight: 16 },
});
