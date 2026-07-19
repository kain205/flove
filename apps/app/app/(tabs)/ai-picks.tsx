import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Bell, Coffee, Flag, Heart, LockKeyhole, MessageCircle, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { Chip } from '@/components/Chip';
import { useCountUp } from '@/lib/useCountUp';
import { actOnPick, ensureTodayMatches, unlockTodayMatchBatch } from '@/services/matching';
import { useAuth } from '@/providers/AuthProvider';
import { colors, gradientForKey, gradients, radii } from '@/theme';
import type { LockedDailyPick, RevealedDailyPick } from '@flove/core';

const MAX_PROCESSING_POLLS = 12;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function cleanInsightLine(line: string) {
  return line
    .replace(/^[-*•✦\d.)\s]+/, '')
    .replace(/^(AI Insight|Insight)\s*[:：-]?\s*/i, '')
    .trim();
}

function splitAiInsights(match: RevealedDailyPick) {
  return (match.aiReason || '')
    .split(/\n+/)
    .map(cleanInsightLine)
    .filter(Boolean)
    .slice(0, 3);
}

export default function AiPicksScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const [decidedIds, setDecidedIds] = useState<Set<string>>(() => new Set());
  const [processingPolls, setProcessingPolls] = useState(0);
  const [unlockConfirmationOpen, setUnlockConfirmationOpen] = useState(false);

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
      if (input.decision === 'reported') {
        void queryClient.invalidateQueries({ queryKey: ['ai-picks', userId] });
      }
      if (input.decision === 'accepted') {
        void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      }
    },
  });
  const unlockMutation = useMutation({
    mutationFn: ({ batchId }: { batchId: string }) => unlockTodayMatchBatch(batchId, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ai-picks', userId] });
    },
  });

  useEffect(() => {
    setDecidedIds(new Set());
    setProcessingPolls(0);
    setUnlockConfirmationOpen(false);
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

  const matches = result.batch.matches.filter(
    (match): match is RevealedDailyPick => match.kind === 'revealed'
      && match.status === 'pending'
      && !decidedIds.has(match.id),
  );
  const lockedMatches = result.batch.matches.filter(
    (match): match is LockedDailyPick => match.kind === 'locked',
  );
  const showLockedPreviews = result.batch.mode === 'stub'
    && result.batch.lockedCount > 0
    && lockedMatches.length > 0;
  const current = matches[0];
  const remaining = matches.length + lockedMatches.length;
  const act = (decision: 'accepted' | 'declined' | 'skipped' | 'reported') => {
    if (!current || actionMutation.isPending) return;
    actionMutation.mutate({ matchId: current.id, decision, userId });
  };
  const requestUnlock = () => {
    if (!showLockedPreviews || unlockMutation.isPending) return;
    setUnlockConfirmationOpen(true);
  };
  const confirmUnlock = () => {
    if (!showLockedPreviews || unlockMutation.isPending) return;
    setUnlockConfirmationOpen(false);
    unlockMutation.mutate({ batchId: result.batch.id });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>AI Picks</Text>
          <Text style={styles.subtitle}>Gợi ý hôm nay · {remaining} người còn lại</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở F-Love AI Coach"
            onPress={() => router.push('/preference-chat')}
            style={styles.coachButton}
          >
            <Sparkles size={16} color={colors.primaryStrong} />
            <Text style={styles.coachButtonText}>AI Coach</Text>
          </Pressable>
          <View style={styles.bell}>
            <Bell size={19} color={colors.primaryText} />
          </View>
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
        ) : lockedMatches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 14 }}>🎉</Text>
            <Text style={styles.emptyTitle}>Hết gợi ý hôm nay</Text>
            <Text style={styles.emptyBody}>
              Bạn đã xử lý toàn bộ AI Picks hôm nay. Quay lại sau để nhận batch mới nhé.
            </Text>
          </View>
        ) : null}
        {showLockedPreviews ? (
          <LockedPicksPanel
            picks={lockedMatches}
            lockedCount={result.batch.lockedCount}
            priceVnd={result.batch.priceVnd}
            busy={unlockMutation.isPending}
            error={unlockMutation.isError
              ? (unlockMutation.error instanceof Error ? unlockMutation.error.message : 'Chưa mở khóa được batch demo.')
              : undefined}
            onUnlock={requestUnlock}
          />
        ) : null}
      </ScrollView>
      <UnlockConfirmation
        visible={unlockConfirmationOpen && showLockedPreviews}
        priceVnd={result.batch.priceVnd}
        onCancel={() => setUnlockConfirmationOpen(false)}
        onConfirm={confirmUnlock}
      />
    </SafeAreaView>
  );
}

function UnlockConfirmation({
  visible,
  priceVnd,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  priceVnd: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View accessibilityLabel="Xác nhận mở khóa giả lập" style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Mở khóa bản demo?</Text>
          <Text style={styles.modalBody}>
            Đây là thao tác giả lập, không phát sinh thanh toán. Giá dự kiến cho một batch là{' '}
            {priceVnd.toLocaleString('vi-VN')}đ.
          </Text>
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>Để sau</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Xác nhận mở khóa giả lập"
              accessibilityRole="button"
              onPress={onConfirm}
              style={styles.modalConfirmButton}
            >
              <Text style={styles.modalConfirmText}>Mở khóa giả lập</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

function LockedPicksPanel({
  picks,
  lockedCount,
  priceVnd,
  busy,
  error,
  onUnlock,
}: {
  picks: LockedDailyPick[];
  lockedCount: number;
  priceVnd: number;
  busy: boolean;
  error?: string;
  onUnlock: () => void;
}) {
  return (
    <View style={styles.lockedPanel}>
      <View style={styles.lockedHeading}>
        <View style={styles.lockedTitleRow}>
          <LockKeyhole size={18} color={colors.primaryStrong} />
          <Text style={styles.lockedTitle}>{lockedCount} gợi ý đang khóa</Text>
        </View>
        <Text style={styles.lockedBody}>
          Preview chỉ hiển thị chỉ số xếp hạng, không tiết lộ danh tính hay hồ sơ.
        </Text>
      </View>
      <View style={styles.lockedList}>
        {picks.map(pick => (
          <View key={pick.previewId} style={styles.lockedRow}>
            <View style={styles.lockedIcon}>
              <LockKeyhole size={16} color={colors.muted} />
            </View>
            <View style={styles.lockedCopy}>
              <Text style={styles.lockedLabel}>{pick.compatibilityLabel}</Text>
              <Text style={styles.lockedDisclaimer}>Chỉ số tương hợp, không phải xác suất thành đôi</Text>
            </View>
            <Text style={styles.lockedScore}>{clamp(pick.compatibilityScore)}%</Text>
          </View>
        ))}
      </View>
      {error ? <Text style={styles.actionError}>{error}</Text> : null}
      <Pressable disabled={busy} onPress={onUnlock} style={[styles.unlockButton, busy && styles.unlockButtonDisabled]}>
        {busy ? <ActivityIndicator color={colors.onPrimary} /> : <LockKeyhole size={17} color={colors.onPrimary} />}
        <Text style={styles.unlockButtonText}>
          {busy ? 'Đang mở khóa…' : `Mở khóa giả lập · ${priceVnd.toLocaleString('vi-VN')}đ/batch`}
        </Text>
      </Pressable>
      <Text style={styles.demoNote}>Bản demo không thu tiền và không tạo giao dịch thật.</Text>
    </View>
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
  match: RevealedDailyPick;
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
          <View style={styles.scoreBadge}>
            <Heart size={13} color={colors.primaryText} fill={colors.primaryText} />
            <Text style={styles.scoreBadgeText}>{score}%</Text>
            <Text style={styles.scoreBadgeSub}>{match.compatibilityLabel}</Text>
          </View>
          <View style={styles.cardHeaderText}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName}>{candidate.name}, {candidate.age}</Text>
            </View>
            <Text style={styles.cardMeta}>
              {[major, school].filter(Boolean).join(' · ')}
            </Text>
            {candidate.bio ? (
              <Text style={styles.cardQuote} numberOfLines={2}>
                “{candidate.bio}”
              </Text>
            ) : null}
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

          {insights.length > 0 ? (
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
            </View>
          ) : null}

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coachButton: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: colors.surfaceTint,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachButtonText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
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
  cardMeta: { fontSize: 13, color: 'rgba(255,255,255,0.95)', marginTop: 2, fontWeight: '500' },
  cardQuote: { color: colors.onPrimary, fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 10, maxWidth: '95%' },

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

  lockedPanel: {
    width: '100%',
    maxWidth: 430,
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  lockedHeading: { marginBottom: 14 },
  lockedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  lockedTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  lockedBody: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  lockedList: { gap: 9, marginBottom: 16 },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 14,
    backgroundColor: colors.surfaceTint,
  },
  lockedIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  lockedCopy: { flex: 1 },
  lockedLabel: { color: colors.text, fontWeight: '800', fontSize: 13 },
  lockedDisclaimer: { color: colors.muted, fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  lockedScore: { color: colors.primaryStrong, fontSize: 18, fontWeight: '900' },
  unlockButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  unlockButtonDisabled: { opacity: 0.65 },
  unlockButtonText: { color: colors.onPrimary, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  demoNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: 8 },

  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(31, 19, 13, 0.42)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 22,
  },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: '900', marginBottom: 8 },
  modalBody: { color: colors.textSoft, fontSize: 14, lineHeight: 21 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  modalCancelButton: { borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11 },
  modalCancelText: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  modalConfirmButton: { borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.primary },
  modalConfirmText: { color: colors.onPrimary, fontSize: 13, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptyBody: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginBottom: 22 },
  resetBtn: { borderWidth: 1.5, borderColor: colors.borderSoft, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 22, borderRadius: radii.md },
  resetText: { fontWeight: '600', fontSize: 14, color: colors.primaryText },
});
