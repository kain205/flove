import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { getProfileReadiness } from '@flove/core';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { MeterBar } from '@/components/MeterBar';
import { TextField } from '@/components/TextField';
import { loadCurrentProfile, saveProfile } from '@/services/profile';
import { signOut } from '@/services/auth';
import { colors, gradients, radii } from '@/theme';

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: loadCurrentProfile });
  const profile = profileQuery.data;
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setBio(profile.bio ?? '');
  }, [profile]);

  const handleSave = async () => {
    try {
      await saveProfile({
        ...profile,
        name,
        bio,
        interests: profile?.interests ?? [],
        personalityTags: profile?.personalityTags ?? [],
        datingGoals: profile?.datingGoals ?? [],
        preferredVibes: profile?.preferredVibes ?? [],
      });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Đã lưu', 'Hồ sơ đã được cập nhật.');
    } catch (error) {
      Alert.alert('Lưu thất bại', error instanceof Error ? error.message : 'Thử lại sau.');
    }
  };

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const completeness = Math.max(0, Math.min(100, Math.round(profile?.profileCompleteness ?? 0)));
  const interests = profile?.interests ?? [];
  const readiness = getProfileReadiness(profile ?? {});
  const displayName = name || profile?.name || 'Hồ sơ';
  const initial = displayName.trim() ? Array.from(displayName.trim())[0].toUpperCase() : 'F';
  const school = profile?.profileText.school?.trim();
  const major = profile?.profileText.majorLabel?.trim();
  const location = [major, school].filter(Boolean).join(' · ');
  const genderLabels: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác', prefer_not_to_show: '' };
  const details = [profile?.gender ? genderLabels[profile.gender] : '', profile?.heightCm ? `${profile.heightCm} cm` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Hồ sơ</Text>

        <View style={styles.identity}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
          <View>
            <Text style={styles.name}>
              {displayName}
              {profile?.age ? `, ${profile.age}` : ''}
            </Text>
            <Text style={styles.location}>📍 {location || 'FPT University'}</Text>
            {details ? <Text style={styles.location}>{details}</Text> : null}
          </View>
        </View>

        <View style={styles.completeCard}>
          <MeterBar label="Độ hoàn thiện hồ sơ" value={completeness} />
          <Text style={styles.completeHint}>
            {readiness.isComplete ? 'Gu ghép đôi đã sẵn sàng cho AI Picks.' : 'Cập nhật onboarding để mở khóa AI Picks chính xác hơn.'}
          </Text>
        </View>

        <TextField label="Tên hiển thị" value={name} onChangeText={setName} placeholder="Tên của bạn" />
        <TextField label="Giới thiệu" value={bio} onChangeText={setBio} placeholder="Giới thiệu ngắn về bạn" multiline />

        <Text style={styles.fieldLabel}>Tín hiệu ghép đôi</Text>
        <View style={styles.interests}>
          {interests.length > 0 ? interests.map(item => (
            <Chip key={item} label={item} />
          )) : <Chip label="Chưa có signal" variant="dashed" />}
        </View>

        <Button variant="light" onPress={() => router.push('/onboarding?mode=edit')}>Cập nhật gu ghép đôi</Button>
        <Button onPress={handleSave}>Lưu hồ sơ</Button>
        <Button variant="secondary" onPress={() => void signOut()}>Đăng xuất</Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 22, gap: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D6764C',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  avatarText: { color: colors.onPrimary, fontWeight: '800', fontSize: 32 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  location: { fontSize: 13, color: colors.muted, marginTop: 2 },

  completeCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 9 },
  completeHint: { fontSize: 12, color: colors.muted },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textSoft },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
