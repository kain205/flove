import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Bell, Coffee, Flag, Heart, MessageCircle, RotateCcw, Sparkles, Star, X } from 'lucide-react-native';
import { Chip } from '@/components/Chip';
import { useCountUp } from '@/lib/useCountUp';
import { actOnPick, ensureTodayMatches } from '@/services/matching';
import { useAuth } from '@/providers/AuthProvider';
import { colors, gradientForKey, gradients, radii } from '@/theme';
import type { CuratedMatch } from '@flove/core';

const MAX_PROCESSING_POLLS = 12;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function subScores(score: number) {
  return {
    values: clamp(score - 3),
    interests: clamp(score + 2),
    personality: clamp(score - 1),
  };
}

function cleanInsightLine(line: string) {
  return line
    .replace(/^[-*•✦\d.)\s]+/, '')
    .replace(/^(AI Insight|Insight)\s*[:：-]?\s*/i, '')
    .trim();
}

function splitAiInsights(match: CuratedMatch) {
  const lines = (match.aiReason || '')
    .split(/\n+/)
    .map(cleanInsightLine)
    .filter(Boolean);

  if (lines.length >= 2) return lines.slice(0, 3);

  const candidate = match.candidate;
  const fallback = lines[0] ? [lines[0]] : [];
  if (candidate.datingGoals.length > 0) {
    fallback.push(`Cả hai có tín hiệu cùng hướng tới ${candidate.datingGoals.slice(0, 2).join(' và ')}.`);
  }
  if (candidate.interests.length > 0) {
    fallback.push(`Bạn có thể bắt nhịp qua ${candidate.interests.slice(0, 3).join(', ')}.`);
  }
  if (candidate.preferredVibes.length > 0) {
    fallback.push(`Vibe nổi bật: ${candidate.preferredVibes.slice(0, 2).join(', ')}, dễ mở chuyện nhẹ nhàng.`);
  }
  if (candidate.bio && fallback.length < 3) {
    fallback.push(candidate.bio.length > 105 ? `${candidate.bio.slice(0, 102)}...` : candidate.bio);
  }
  return fallback.slice(0, 3);
}

export default function AiPicksScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const [decidedIds, setDecidedIds] = useState<Set<string>>(() => new Set());
  const [processingPolls, setProcessingPolls] = useState(0);

  const matchesQuery = useQuery({
    queryKey: ['ai-picks', userId],
    queryFn: () => ensureTodayMatches(userId),
    enabled: Boolean(userId),
    retry: false,
    refetchInterval: query => {
      const result = query.state.data;
      if (result?.status !== 'processing' || processingPolls >= MAX_PROCESSING_POLLS) return false;
      return Math.max(500, Math.min(result.retryAfterMs, 5_000));
    },
  });
  const actionMutation = useMutation({
    mutationFn: actOnPick,
    onSuccess: (_data, input) => {
      if (input.userId !== userId) return;
      setDecidedIds(previous => new Set(previous).add(input.matchId));
      if (input.decision === 'accepted') {
        void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      }
    },
  });

  useEffect(() => {
    setDecidedIds(new Set());
    setProcessingPolls(0);
  }, [userId]);

  useEffect(() => {
    if (matchesQuery.data?.status === 'processing' && matchesQuery.dataUpdatedAt > 0) {
      setProcessingPolls(count => Math.min(count + 1, MAX_PROCESSING_POLLS));
    } else if (matchesQuery.data?.status && matchesQuery.data.status !== 'processing') {
      setProcessingPolls(0);
    }
  }, [matchesQuery.data?.status, matchesQuery.dataUpdatedAt]);

  const retry = () => {
    setProcessingPolls(0);
    void matchesQuery.refetch();
  };

  if (matchesQuery.isLoading || !userId) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (matchesQuery.isError) {
    return (
      <StatusScreen
        icon="⚠️"
        title="Chưa tải được gợi ý"
        body={matchesQuery.error instanceof Error ? matchesQuery.error.message : 'Đã có lỗi kết nối. Dữ liệu của bạn vẫn an toàn.'}
        actionLabel="Thử lại"
        onAction={retry}
      />
    );
  }

  const result = matchesQuery.data;
  if (!result) return <StatusScreen icon="⚠️" title="Chưa tải được gợi ý" body="Vui lòng thử lại." actionLabel="Thử lại" onAction={retry} />;
  if (result.status === 'processing') {
    const paused = processingPolls >= MAX_PROCESSING_POLLS;
    return (
      <StatusScreen
        loading={!paused}
        icon="✨"
        title={paused ? 'Gợi ý đang mất nhiều thời gian hơn dự kiến' : 'Đang chuẩn bị AI Picks'}
        body={paused ? 'Bạn có thể thử tải lại. Tiến trình trên server vẫn tiếp tục an toàn.' : 'Hệ thống đang chọn những hồ sơ phù hợp nhất cho bạn.'}
        actionLabel={paused ? 'Kiểm tra lại' : undefined}
        onAction={paused ? retry : undefined}
      />
    );
  }
  if (result.status === 'needs_onboarding') {
    return (
      <StatusScreen
        icon="📝"
        title="Hãy hoàn thiện hồ sơ"
        body="AI Picks cần hồ sơ đã xác nhận và đủ thông tin để đưa ra gợi ý an toàn."
        actionLabel="Tiếp tục hồ sơ"
        onAction={() => router.replace('/onboarding')}
      />
    );
  }
  if (result.status === 'empty') {
    return (
      <StatusScreen
        icon="🌱"
        title="Chưa có gợi ý phù hợp"
        body={result.reason === 'all_recently_seen'
          ? 'Bạn đã xem các hồ sơ phù hợp gần đây. Hệ thống sẽ tự thử lại khi có lựa chọn mới.'
          : 'Hiện chưa có hồ sơ vượt qua các tiêu chí an toàn và sở thích hai chiều. Hãy quay lại sau nhé.'}
        actionLabel="Kiểm tra lại"
        onAction={retry}
      />
    );
  }

  const matches = result.batch.matches.filter(match => match.status === 'pending' && !decidedIds.has(match.id));
  const current: CuratedMatch | undefined = matches[0];
  const remaining = matches.length;
  const act = (decision: 'accepted' | 'declined' | 'skipped' | 'reported') => {
    if (!current || actionMutation.isPending) return;
    actionMutation.mutate({ matchId: current.id, decision, userId });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Picks</Text>
          <Text style={styles.subtitle}>Gợi ý hôm nay · {remaining} người còn lại</Text>
        </View>
        <View style={styles.bell}>
          <Bell size={19} color={colors.primaryText} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {current ? (
          <PickCard
            key={current.id}
            match={current}
            onLike={() => act('accepted')}
            onSkip={() => act('skipped')}
            onDecline={() => act('declined')}
            onReport={() => Alert.alert(
              'Báo cáo hồ sơ này?',
              'Hồ sơ sẽ bị ẩn khỏi gợi ý của bạn. Đội ngũ an toàn sẽ xem xét báo cáo.',
              [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Báo cáo và ẩn', style: 'destructive', onPress: () => act('reported') },
              ],
            )}
            busy={actionMutation.isPending}
            actionError={actionMutation.isError
              ? (actionMutation.error instanceof Error ? actionMutation.error.message : 'Chưa lưu được lựa chọn. Vui lòng thử lại.')
              : undefined}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 14 }}>🎉</Text>
            <Text style={styles.emptyTitle}>Hết gợi ý hôm nay</Text>
            <Text style={styles.emptyBody}>
              Bạn đã xử lý toàn bộ AI Picks hôm nay. Quay lại sau để nhận batch mới nhé.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusScreen({
  icon,
  title,
  body,
  loading,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.statusPanel}>
        {loading ? <ActivityIndicator color={colors.primary} style={styles.statusSpinner} /> : <Text style={styles.statusIcon}>{icon}</Text>}
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} style={styles.resetBtn}>
            <Text style={styles.resetText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PickCard({
  match,
  onLike,
  onSkip,
  onDecline,
  onReport,
  busy,
  actionError,
}: {
  match: CuratedMatch;
  onLike: () => void;
  onSkip: () => void;
  onDecline: () => void;
  onReport: () => void;
  busy: boolean;
  actionError?: string;
}) {
  const { candidate } = match;
  const school = candidate.profileText.school?.trim();
  const major = candidate.profileText.majorLabel?.trim();
  const sub = subScores(match.compatibilityScore);
  const tags = candidate.interests.slice(0, 3);
  const initial = candidate.name.trim() ? Array.from(candidate.name.trim())[0].toUpperCase() : '?';
  const score = useCountUp(clamp(match.compatibilityScore));
  const insights = splitAiInsights(match);
  const avatarUrl = candidate.avatarUrl.trim();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl, match.id]);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(enter, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [enter]);
  const enterStyle = {
    opacity: enter,
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
    ],
  };

  return (
    <Animated.View style={[styles.pickShell, enterStyle]}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.profilePhoto}>
            <LinearGradient
              colors={gradientForKey(candidate.id || candidate.name)}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profilePhotoImage}
            />
            {avatarUrl && !imageFailed ? (
              <Image
                source={{ uri: avatarUrl }}
                resizeMode="cover"
                style={styles.profilePhotoImage}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Text style={styles.ghostInitial}>{initial}</Text>
            )}
            <LinearGradient
              colors={['rgba(37, 22, 11, 0.12)', 'rgba(193, 83, 11, 0.62)', 'rgba(116, 48, 13, 0.92)']}
              locations={[0, 0.58, 1]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.photoOverlay}
            />
          </View>
          <LinearGradient
            colors={gradientForKey(candidate.id || candidate.name)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.colorWash}
          />
          <View style={styles.photoProgress}>
            {Array.from({ length: 5 }).map((_, barIndex) => (
              <View key={barIndex} style={styles.photoProgressTrack}>
                <View style={[styles.photoProgressFill, barIndex === 0 ? styles.photoProgressActive : null]} />
              </View>
            ))}
          </View>
          <View style={styles.scoreBadge}>
            <Heart size={13} color={colors.primaryText} fill={colors.primaryText} />
            <Text style={styles.scoreBadgeText}>{score}%</Text>
            <Text style={styles.scoreBadgeSub}>độ phù hợp</Text>
          </View>
          <View style={styles.cardHeaderText}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>
                {candidate.name}, {candidate.age}
              </Text>
              <Text style={styles.verified}>✓</Text>
            </View>
            <Text style={styles.cardMeta}>
              {[major, school].filter(Boolean).join(' · ')}
            </Text>
            {candidate.bio ? (
              <Text style={styles.cardQuote} numberOfLines={2}>
                “{candidate.bio}”
              </Text>
            ) : null}
            <View style={styles.cardChips}>
              <View style={styles.heroChip}>
                <Heart size={12} color={colors.primaryText} fill={colors.primaryText} />
                <Text style={styles.heroChipText}>Giá trị sống</Text>
              </View>
              <View style={styles.heroChip}>
                <Star size={12} color="#C99013" fill="#F9CA55" />
                <Text style={styles.heroChipText}>Sở thích chung</Text>
              </View>
              <View style={styles.heroChipLavender}>
                <Sparkles size={12} color="#9A72C7" />
                <Text style={styles.heroChipLavenderText}>Giao tiếp tốt</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.actions}>
            <Pressable onPress={onSkip} disabled={busy} style={styles.sideActionBtn}>
              <View style={styles.actionCircle}>
                <RotateCcw size={22} color={colors.primaryText} />
              </View>
              <Text style={styles.actionLabel}>Bỏ qua</Text>
            </Pressable>
            <Pressable onPress={onDecline} disabled={busy} style={styles.sideActionBtn}>
              <View style={styles.actionCircle}>
                <X size={24} color="#E35B4C" />
              </View>
              <Text style={styles.actionLabel}>Không hợp</Text>
            </Pressable>
            <Pressable onPress={onLike} disabled={busy} style={styles.likeShadow}>
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likeBtn}>
                <Heart size={27} color={colors.onPrimary} fill={colors.onPrimary} />
              </LinearGradient>
              <Text style={styles.likeLabel}>Thích</Text>
            </Pressable>
          </View>

          {actionError ? <Text style={styles.actionError}>{actionError}</Text> : null}

          <Pressable accessibilityRole="button" disabled={busy} onPress={onReport} style={styles.reportButton}>
            <Flag color={colors.muted} size={14} />
            <Text style={styles.reportButtonText}>Báo cáo và ẩn hồ sơ</Text>
          </Pressable>

          <View style={styles.insightCard}>
            <View style={styles.insightHead}>
              <View style={styles.insightTitleWrap}>
                <Sparkles size={14} color={colors.primaryStrong} />
                <Text style={styles.insightTitle}>Lý do AI gợi ý bạn</Text>
              </View>
              <View style={styles.insightBadge}>
                <Text style={styles.insightBadgeText}>AI Insight</Text>
              </View>
            </View>

            <View style={styles.insightList}>
              {insights.map((item, itemIndex) => (
                <View key={`${match.id}-${itemIndex}`} style={styles.insightRow}>
                  <View style={styles.insightIcon}>
                    {itemIndex === 0 ? (
                      <Heart size={12} color="#1F130D" fill="#1F130D" />
                    ) : itemIndex === 1 ? (
                      <Coffee size={12} color="#8D5E66" />
                    ) : (
                      <MessageCircle size={12} color="#9B88D6" />
                    )}
                  </View>
                  <Text style={styles.insightText}>{item}</Text>
                </View>
              ))}
            </View>

            <View style={styles.subScoreRow}>
              <Text style={styles.subScoreText}>Giá trị {sub.values}%</Text>
              <Text style={styles.subScoreDot}>•</Text>
              <Text style={styles.subScoreText}>Sở thích {sub.interests}%</Text>
              <Text style={styles.subScoreDot}>•</Text>
              <Text style={styles.subScoreText}>Tính cách {sub.personality}%</Text>
            </View>
          </View>

          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map(tag => (
                <Chip key={tag} label={tag} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  statusIcon: { fontSize: 48, marginBottom: 14 },
  statusSpinner: { marginBottom: 22 },
  header: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  bell: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 22, paddingBottom: 26, alignItems: 'center' },
  pickShell: { width: '100%', maxWidth: 430 },

  card: {
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    shadowColor: '#D6764C',
    shadowOpacity: 0.32,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 18 },
    elevation: 4,
  },
  cardHeader: { aspectRatio: 0.76, justifyContent: 'flex-end', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48, overflow: 'hidden' },
  profilePhoto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  profilePhotoImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  colorWash: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.24 },
  photoProgress: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 3,
    flexDirection: 'row',
    gap: 5,
  },
  photoProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.54)',
  },
  photoProgressFill: { height: '100%', width: '36%', backgroundColor: 'rgba(255, 255, 255, 0.86)' },
  photoProgressActive: { width: '100%', backgroundColor: colors.surface },
  scoreBadge: {
    position: 'absolute',
    top: 22,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 13,
    paddingVertical: 7,
    paddingHorizontal: 10,
    minWidth: 74,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 3,
  },
  scoreBadgeText: { fontWeight: '800', fontSize: 17, color: colors.primaryText },
  scoreBadgeSub: { width: '100%', textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textSoft, marginTop: -2 },
  ghostInitial: {
    position: 'absolute',
    top: '32%',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 88,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '800',
  },
  cardHeaderText: { zIndex: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardName: { fontSize: 24, fontWeight: '800', color: colors.onPrimary },
  verified: { fontSize: 14, color: colors.onPrimary },
  cardMeta: { fontSize: 13, color: 'rgba(255,255,255,0.95)', marginTop: 2, fontWeight: '500' },
  cardQuote: { color: colors.onPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 10, maxWidth: '95%' },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  heroChip: {
    minHeight: 28,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 247, 239, 0.9)',
  },
  heroChipText: { fontSize: 12, color: colors.primaryText, fontWeight: '800' },
  heroChipLavender: {
    minHeight: 28,
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(246, 237, 255, 0.93)',
  },
  heroChipLavenderText: { fontSize: 12, color: '#8B66B7', fontWeight: '800' },

  cardBody: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 20, backgroundColor: '#FFF9F4' },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
    shadowColor: '#D6764C',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  insightHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  insightTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  insightTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  insightBadge: { backgroundColor: '#FBE3D8', borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5 },
  insightBadgeText: { fontSize: 11, color: '#BC6A52', fontWeight: '800' },
  insightList: { gap: 12 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  insightIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFF2E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  insightText: { flex: 1, fontSize: 13.5, lineHeight: 20, color: colors.textSoft, fontWeight: '500' },
  subScoreRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 15 },
  subScoreText: { fontSize: 11.5, color: colors.primaryText, fontWeight: '800' },
  subScoreDot: { fontSize: 11, color: colors.mutedLight, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },

  actions: {
    position: 'absolute',
    top: -35,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 4,
  },
  sideActionBtn: {
    width: 68,
    alignItems: 'center',
    gap: 7,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D6764C',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  actionLabel: { fontSize: 11.5, color: colors.muted, fontWeight: '700', textAlign: 'center' },
  likeShadow: {
    alignItems: 'center',
    gap: 7,
    width: 68,
    borderRadius: 28,
  },
  likeBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  likeLabel: { fontSize: 11.5, color: colors.primaryText, fontWeight: '800', textAlign: 'center' },
  actionError: { color: '#B83D32', fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginBottom: 12, fontWeight: '600' },
  reportButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 12,
    paddingVertical: 6,
  },
  reportButtonText: { color: colors.muted, fontSize: 12, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptyBody: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginBottom: 22 },
  resetBtn: { borderWidth: 1.5, borderColor: colors.borderSoft, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 22, borderRadius: radii.md },
  resetText: { fontWeight: '600', fontSize: 14, color: colors.primaryText },
});
