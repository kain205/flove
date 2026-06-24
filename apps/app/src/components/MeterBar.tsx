import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii } from '@/theme';

interface MeterBarProps {
  label: string;
  value: number; // 0-100
  animate?: boolean;
  delay?: number;
}

/** Labelled compatibility bar that grows + counts up on mount. */
export function MeterBar({ label, value, animate = true, delay = 0 }: MeterBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const progress = useRef(new Animated.Value(animate ? 0 : pct)).current;
  const [display, setDisplay] = useState(animate ? 0 : pct);

  useEffect(() => {
    if (!animate) {
      progress.setValue(pct);
      setDisplay(pct);
      return;
    }
    const id = progress.addListener(({ value: v }) => setDisplay(Math.round(v)));
    const anim = Animated.timing(progress, {
      toValue: pct,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => {
      progress.removeListener(id);
      anim.stop();
    };
  }, [pct, animate, delay, progress]);

  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrap, { width }]}>
          <LinearGradient colors={gradients.meter} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textSoft, fontSize: 12.5, fontWeight: '600' },
  value: { color: colors.primaryStrong, fontSize: 12.5, fontWeight: '800' },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceTint,
    overflow: 'hidden',
  },
  fillWrap: { height: '100%' },
  fill: { flex: 1, borderRadius: radii.pill },
});
