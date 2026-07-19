import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradientForKey } from '@/theme';

interface AvatarProps {
  /** Display name or any stable string; first grapheme is used as the initial. */
  name: string;
  size?: number;
  online?: boolean;
  imageUrl?: string;
  /** Override the derived gradient with a specific pair. */
  gradient?: readonly [string, string];
  radius?: number;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : '?';
}

export function Avatar({ name, size = 54, online, imageUrl = '', gradient, radius }: AvatarProps) {
  const borderRadius = radius ?? size / 2;
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUrl]);
  return (
    <View style={{ width: size, height: size }}>
      {imageUrl && !imageFailed ? (
        <Image
          accessibilityLabel={`Ảnh đại diện của ${name}`}
          onError={() => setImageFailed(true)}
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius }}
        />
      ) : (
        <LinearGradient
          colors={gradient ?? gradientForKey(name)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circle, { width: size, height: size, borderRadius }]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initialOf(name)}</Text>
        </LinearGradient>
      )}
      {online ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.onPrimary, fontWeight: '800' },
  dot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
