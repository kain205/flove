import type { AiPickHistoryItem, RevealedDailyPick } from '@flove/core';
import { Heart, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Chip } from '@/components/Chip';
import { colors, radii } from '@/theme';

export function TodayPickStrip({
  picks,
  selectedId,
  onSelect,
}: {
  picks: RevealedDailyPick[];
  selectedId?: string;
  onSelect: (matchId: string) => void;
}) {
  if (picks.length < 2) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View><Text style={styles.eyebrow}>DASHBOARD HÔM NAY</Text><Text style={styles.sectionTitle}>Chọn hồ sơ để xem kỹ</Text></View>
        <Text style={styles.count}>{picks.length} người</Text>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.todayList} showsHorizontalScrollIndicator={false}>
        {picks.map(pick => {
          const active = pick.id === selectedId;
          return (
            <Pressable key={pick.id} onPress={() => onSelect(pick.id)} style={[styles.todayCard, active && styles.todayCardActive]}>
              <Avatar imageUrl={pick.candidate.avatarUrl} name={pick.candidate.name} size={48} />
              <View style={styles.todayCopy}>
                <Text numberOfLines={1} style={styles.todayName}>{pick.candidate.name}, {pick.candidate.age}</Text>
                <Text style={styles.todayLabel}>{pick.compatibilityLabel}</Text>
              </View>
              <Text style={[styles.todayScore, active && styles.todayScoreActive]}>{pick.compatibilityScore}%</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function LikedPicksGallery({
  items,
  loading,
  error,
  onRetry,
}: {
  items: AiPickHistoryItem[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}) {
  const [selected, setSelected] = useState<AiPickHistoryItem | null>(null);
  if (loading) return <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Đang tải những người bạn đã thích…</Text></View>;
  if (error) return <View style={styles.state}><Text style={styles.stateTitle}>Chưa tải được lịch sử</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={onRetry}><Text style={styles.retry}>Thử lại</Text></Pressable></View>;
  if (!items.length) {
    return (
      <View style={styles.state}>
        <View style={styles.emptyHeart}><Heart color={colors.primaryStrong} size={25} /></View>
        <Text style={styles.stateTitle}>Chưa có hồ sơ đã thích</Text>
        <Text style={styles.stateText}>Khi bạn bấm Thích, hồ sơ an toàn sẽ được lưu tại đây để xem lại.</Text>
      </View>
    );
  }
  return (
    <>
      <View style={styles.historyIntro}>
        <Text style={styles.eyebrow}>BỘ SƯU TẬP CỦA BẠN</Text>
        <Text style={styles.historyTitle}>{items.length} người bạn đã thích</Text>
        <Text style={styles.historyBody}>Chạm vào một hồ sơ để xem lại giới thiệu, sở thích và lý do AI gợi ý.</Text>
      </View>
      <View style={styles.gallery}>
        {items.map(item => (
          <Pressable key={item.matchId} onPress={() => setSelected(item)} style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}>
            <View style={styles.historyTop}>
              <Avatar imageUrl={item.candidate.avatarUrl} name={item.candidate.name} size={62} />
              <View style={styles.scorePill}><Heart color={colors.primaryText} fill={colors.primaryText} size={11} /><Text style={styles.scorePillText}>{item.compatibilityScore}%</Text></View>
            </View>
            <Text numberOfLines={1} style={styles.historyName}>{item.candidate.name}, {item.candidate.age}</Text>
            <Text numberOfLines={1} style={styles.historyMeta}>{item.candidate.profileText.majorLabel || item.candidate.major} · {item.candidate.profileText.school || item.candidate.campus}</Text>
            <View style={styles.likedLine}><Heart color={colors.primaryStrong} fill={colors.primaryStrong} size={12} /><Text style={styles.likedText}>{item.status === 'matched' ? 'Đã match' : 'Đã thích'} · {formatDate(item.likedAt)}</Text></View>
          </Pressable>
        ))}
      </View>
      <LikedPickModal item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function LikedPickModal({ item, onClose }: { item: AiPickHistoryItem | null; onClose: () => void }) {
  if (!item) return null;
  const insights = item.aiReason.split(/\n+/).map(line => line.replace(/^[-*•✦\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 3);
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Avatar imageUrl={item.candidate.avatarUrl} name={item.candidate.name} size={66} />
            <View style={styles.modalHeadCopy}><Text style={styles.modalName}>{item.candidate.name}, {item.candidate.age}</Text><Text style={styles.modalLabel}>{item.compatibilityScore}% · {item.compatibilityLabel}</Text></View>
            <Pressable accessibilityLabel="Đóng hồ sơ" onPress={onClose} style={styles.close}><X color={colors.textSoft} size={19} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {item.candidate.bio ? <Text style={styles.bio}>“{item.candidate.bio}”</Text> : null}
            {item.candidate.interests.length ? <View style={styles.chips}>{item.candidate.interests.slice(0, 6).map(tag => <Chip key={tag} label={tag} />)}</View> : null}
            {insights.length ? (
              <View style={styles.insights}>
                <View style={styles.insightHead}><Sparkles color={colors.primaryStrong} size={15} /><Text style={styles.insightTitle}>Vì sao AI từng gợi ý</Text></View>
                {insights.map((insight, index) => <View key={`${item.matchId}-${index}`} style={styles.insightRow}><Text style={styles.insightNumber}>0{index + 1}</Text><Text style={styles.insightText}>{insight}</Text></View>)}
              </View>
            ) : null}
            <Text style={styles.disclaimer}>Compatibility là chỉ số xếp hạng heuristic, không phải xác suất thành đôi.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
}

const styles = StyleSheet.create({
  section: { maxWidth: 940, width: '100%' },
  sectionHead: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  eyebrow: { color: colors.primaryText, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.4 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  count: { color: colors.muted, fontSize: 10.5 },
  todayList: { gap: 9, paddingBottom: 3 },
  todayCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 9, minWidth: 220, padding: 9 },
  todayCardActive: { backgroundColor: colors.surfaceTint, borderColor: colors.primary },
  todayCopy: { flex: 1, minWidth: 0 },
  todayName: { color: colors.text, fontSize: 12.5, fontWeight: '900' },
  todayLabel: { color: colors.muted, fontSize: 9.5, marginTop: 2 },
  todayScore: { color: colors.textSoft, fontSize: 15, fontWeight: '900' },
  todayScoreActive: { color: colors.primaryStrong },
  state: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, gap: 9, marginTop: 18, maxWidth: 440, padding: 30, width: '100%' },
  stateTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  stateText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retry: { color: colors.primaryText, fontSize: 12, fontWeight: '900' },
  emptyHeart: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: 24, height: 56, justifyContent: 'center', width: 56 },
  historyIntro: { alignSelf: 'center', maxWidth: 940, paddingBottom: 15, width: '100%' },
  historyTitle: { color: colors.text, fontSize: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  historyBody: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  gallery: { alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 12, maxWidth: 940, width: '100%' },
  historyCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 21, borderWidth: 1, flexGrow: Platform.OS === 'web' ? 0 : 1, minWidth: 156, padding: 14, width: Platform.OS === 'web' ? 218 : '47%' },
  historyTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  scorePill: { alignItems: 'center', backgroundColor: colors.surfaceTint, borderRadius: radii.pill, flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  scorePillText: { color: colors.primaryText, fontSize: 10, fontWeight: '900' },
  historyName: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 11 },
  historyMeta: { color: colors.muted, fontSize: 9.5, marginTop: 3 },
  likedLine: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 11 },
  likedText: { color: colors.primaryText, fontSize: 9.5, fontWeight: '800' },
  pressed: { opacity: 0.76 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(43,33,26,0.48)', flex: 1, justifyContent: 'center', padding: 18 },
  modal: { backgroundColor: colors.surface, borderRadius: 25, maxHeight: '86%', maxWidth: 560, overflow: 'hidden', width: '100%' },
  modalHead: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 12, padding: 18 },
  modalHeadCopy: { flex: 1 },
  modalName: { color: colors.text, fontSize: 19, fontWeight: '900' },
  modalLabel: { color: colors.primaryText, fontSize: 11.5, fontWeight: '800', marginTop: 3 },
  close: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 16, height: 36, justifyContent: 'center', width: 36 },
  modalBody: { gap: 14, padding: 19 },
  bio: { color: colors.textSoft, fontSize: 14, fontWeight: '600', lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  insights: { backgroundColor: colors.surfaceWarm, borderColor: colors.noteBorder, borderRadius: 19, borderWidth: 1, gap: 10, padding: 15 },
  insightHead: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  insightTitle: { color: colors.text, fontSize: 13.5, fontWeight: '900' },
  insightRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  insightNumber: { color: colors.primaryText, fontSize: 9, fontWeight: '900', paddingTop: 2 },
  insightText: { color: colors.textSoft, flex: 1, fontSize: 11.5, lineHeight: 17 },
  disclaimer: { color: colors.muted, fontSize: 9.5, lineHeight: 14 },
});
