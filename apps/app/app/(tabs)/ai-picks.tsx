import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ImageBackground, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Coffee, Heart, MessageCircle, RotateCcw, Sparkles, Star, X } from 'lucide-react-native';
import { Chip } from '@/components/Chip';
import { useCountUp } from '@/lib/useCountUp';
import { acceptPick, declinePick, loadOrGenerateTodayMatches } from '@/services/matching';
import { colors, gradientForKey, gradients, radii } from '@/theme';
import type { CuratedMatch } from '@flove/core';

const profilePhotos = [
  require('../../../../image.png'),
  require('../../../../image2.png'),
  require('../../../../image3.png'),
  require('../../../../image4.png'),
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function profilePhotoFor(pickIndex: number) {
  return profilePhotos[pickIndex % profilePhotos.length];
}

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
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);

  const matchesQuery = useQuery({
    queryKey: ['ai-picks', 'today'],
    queryFn: loadOrGenerateTodayMatches,
  });
  const acceptMutation = useMutation({
    mutationFn: acceptPick,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const declineMutation = useMutation({ mutationFn: declinePick });

  if (matchesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const matches = matchesQuery.data?.matches ?? [];
  const current: CuratedMatch | undefined = matches[index];
  const remaining = Math.max(0, matches.length - index);

  const advance = () => setIndex(i => i + 1);
  const onLike = () => {
    if (current) acceptMutation.mutate(current.id);
    advance();
  };
  const onSkip = () => {
    if (current) declineMutation.mutate(current.id);
    advance();
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
            pickIndex={index}
            onLike={onLike}
            onSkip={onSkip}
            busy={acceptMutation.isPending || declineMutation.isPending}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52, marginBottom: 14 }}>🎉</Text>
            <Text style={styles.emptyTitle}>Hết gợi ý hôm nay</Text>
            <Text style={styles.emptyBody}>
              {matches.length === 0
                ? 'Chưa có pick nào. Hãy hoàn thiện hồ sơ hoặc quay lại sau nhé.'
                : 'Quay lại vào ngày mai để nhận batch mới, hoặc thử Blind Date nhé.'}
            </Text>
            {matches.length > 0 ? (
              <Pressable onPress={() => setIndex(0)} style={styles.resetBtn}>
                <Text style={styles.resetText}>Xem lại từ đầu</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PickCard({
  match,
  pickIndex,
  onLike,
  onSkip,
  busy,
}: {
  match: CuratedMatch;
  pickIndex: number;
  onLike: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const { candidate } = match;
  const school = candidate.profileText.school?.trim();
  const major = candidate.profileText.majorLabel?.trim();
  const sub = subScores(match.compatibilityScore);
  const tags = candidate.interests.slice(0, 3);
  const initial = candidate.name.trim() ? Array.from(candidate.name.trim())[0].toUpperCase() : '?';
  const score = useCountUp(clamp(match.compatibilityScore));
  const insights = splitAiInsights(match);
  const profilePhoto = profilePhotoFor(pickIndex);

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
          <ImageBackground source={profilePhoto} resizeMode="cover" style={styles.profilePhoto} imageStyle={styles.profilePhotoImage}>
            <LinearGradient
              colors={['rgba(37, 22, 11, 0.12)', 'rgba(193, 83, 11, 0.62)', 'rgba(116, 48, 13, 0.92)']}
              locations={[0, 0.58, 1]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={styles.photoOverlay}
            />
          </ImageBackground>
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
          <Text style={styles.ghostInitial}>{initial}</Text>
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
            <Pressable onPress={onSkip} disabled={busy} style={styles.sideActionBtn}>
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
  profilePhotoImage: { width: '100%', height: '100%' },
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
  ghostInitial: { display: 'none' },
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

  empty: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptyBody: { fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginBottom: 22 },
  resetBtn: { borderWidth: 1.5, borderColor: colors.borderSoft, backgroundColor: colors.surface, paddingVertical: 12, paddingHorizontal: 22, borderRadius: radii.md },
  resetText: { fontWeight: '600', fontSize: 14, color: colors.primaryText },
});
