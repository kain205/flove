import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

import logoImage from '../assets/logo.png';

interface BrandMarkProps {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
}

/** App logo mark, optionally with the F-Love wordmark + tagline. */
export function BrandMark({ size = 40, showWordmark = false, showTagline = false }: BrandMarkProps) {
  return (
    <View style={styles.row}>
      <Image source={logoImage} resizeMode="cover" style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3 }]} />
      {showWordmark ? (
        <View>
          <Text style={styles.wordmark}>F-Love</Text>
          {showTagline ? <Text style={styles.tagline}>CONNECT · SHARE · GROW</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  tile: {
    shadowColor: '#D6764C',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  wordmark: { fontWeight: '800', fontSize: 19, color: colors.text, letterSpacing: -0.2 },
  tagline: {
    fontSize: 8.5,
    letterSpacing: 2,
    color: '#C2825F',
    marginTop: 2,
    ...Platform.select({ web: { fontFamily: fonts.mono } }),
  },
});
