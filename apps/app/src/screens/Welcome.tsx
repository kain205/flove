import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, gradients, radii } from '@/theme';

import logoImage from '../assets/logo.png';

function goLogin() {
  router.push('/login');
}

/** Native welcome / splash screen (mirrors the web landing entry point on mobile). */
export function Welcome() {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <LinearGradient colors={gradients.welcome} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Animated.View style={[styles.logoTile, { transform: [{ translateY }] }]}>
            <Image source={logoImage} resizeMode="cover" style={styles.logoImage} />
          </Animated.View>
          <Text style={styles.brand}>F-Love</Text>
          <Text style={styles.tagline}>CONNECT · SHARE · GROW</Text>
          <Text style={styles.lead}>Ứng dụng hẹn hò ghép đôi bằng AI dành cho sinh viên.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={goLogin} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Bắt đầu</Text>
          </Pressable>
          <Pressable onPress={goLogin} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Đã có tài khoản? Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 32, paddingVertical: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoTile: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  brand: { fontSize: 36, fontWeight: '800', color: colors.onPrimary, letterSpacing: -0.4 },
  tagline: { fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  lead: {
    fontSize: 16,
    lineHeight: 25,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 28,
    maxWidth: 280,
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: { gap: 12, paddingBottom: 8 },
  primaryBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 17,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.primaryStrong, fontWeight: '700', fontSize: 16 },
  ghostBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 15,
    borderRadius: radii.lg,
    alignItems: 'center',
  },
  ghostBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 15 },
});
