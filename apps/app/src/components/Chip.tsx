import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/theme';

interface ChipProps {
  label: string;
  variant?: 'solid' | 'dashed';
}

/** Pill tag used for interests / match tags. */
export function Chip({ label, variant = 'solid' }: ChipProps) {
  return (
    <View style={[styles.chip, variant === 'dashed' && styles.dashed]}>
      <Text style={[styles.text, variant === 'dashed' && styles.dashedText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surfaceTint,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
  },
  dashed: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E0C4A8',
  },
  text: { color: colors.primaryDark, fontSize: 12.5, fontWeight: '600' },
  dashedText: { color: '#C2825F' },
});
