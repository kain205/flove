import { useMutation } from '@tanstack/react-query';
import { findBlindDatePartner } from '@flove/supabase';
import { router } from 'expo-router';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, gradients, radii } from '@/theme';

export default function BlindDateScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const mutation = useMutation({
    mutationFn: (expectedUserId: string) => findBlindDatePartner(supabase, expectedUserId),
    onSuccess: (data, expectedUserId) => {
      if (expectedUserId !== userId) return;
      if (data.waiting) {
        Alert.alert('Đang chờ', 'Mình sẽ giữ bạn trong hàng chờ. Chạm lại để kiểm tra khi có người mới.');
        return;
      }
      Alert.alert('Đã ghép đôi', `Người ghép: ${data.partnerMaskedName ?? 'Người ẩn danh'}`, [
        {
          text: 'Mở trò chuyện',
          onPress: () => data.conversationId && router.push({
            pathname: '/chat/[conversationId]',
            params: { conversationId: data.conversationId, blindSessionId: data.sessionId },
          }),
        },
      ]);
    },
    onError: (error, expectedUserId) => {
      if (expectedUserId !== userId) return;
      Alert.alert('Blind Date', error instanceof Error ? error.message : 'Thử lại sau.');
    },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Blind Date</Text>
        <Text style={styles.subtitle}>Trò chuyện ẩn danh, tiết lộ danh tính khi cả hai sẵn sàng.</Text>

        <LinearGradient colors={gradients.heroCard} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={styles.hero}>
          <Text style={{ fontSize: 46, marginBottom: 10 }}>🎭</Text>
          <Text style={styles.heroTitle}>Ghép ngẫu nhiên</Text>
          <Text style={styles.heroBody}>
            Hệ thống tìm một người phù hợp đang online. Danh tính được giấu cho tới khi cả hai chọn tiết lộ.
          </Text>
          <Pressable onPress={() => userId && mutation.mutate(userId)} disabled={!userId || mutation.isPending} style={styles.heroBtn}>
            <Text style={styles.heroBtnText}>{mutation.isPending ? 'Đang tìm...' : 'Tìm người ghép'}</Text>
          </Pressable>
        </LinearGradient>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>312</Text>
            <Text style={styles.statLabel}>đang online</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: colors.primary }]}>~20s</Text>
            <Text style={styles.statLabel}>thời gian chờ</Text>
          </View>
        </View>

        <View style={styles.note}>
          <Text style={{ fontSize: 15 }}>🛡️</Text>
          <Text style={styles.noteText}>
            Cuộc trò chuyện ẩn danh tách biệt với AI Picks và được bảo vệ an toàn.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: 22, gap: 0 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, color: colors.muted, marginTop: 2, marginBottom: 22 },

  hero: {
    borderRadius: radii.xxl,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#D6764C',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: colors.onPrimary },
  heroBody: { fontSize: 13.5, lineHeight: 21, color: 'rgba(255,255,255,0.95)', marginTop: 8, textAlign: 'center', maxWidth: 240 },
  heroBtn: { marginTop: 20, width: '100%', backgroundColor: colors.surface, paddingVertical: 16, borderRadius: radii.lg, alignItems: 'center' },
  heroBtnText: { color: colors.primaryStrong, fontWeight: '700', fontSize: 16 },

  stats: { flexDirection: 'row', gap: 12, marginTop: 18 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 16 },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.primaryStrong },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },

  note: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.noteBg,
    borderWidth: 1,
    borderColor: colors.noteBorder,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: colors.noteText },
});
