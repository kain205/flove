import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radii } from '@/theme';

type Variant = 'primary' | 'secondary' | 'light';

interface ButtonProps extends PropsWithChildren {
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  radius?: number;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  disabled,
  variant = 'primary',
  radius = radii.lg,
  style,
}: ButtonProps) {
  const label = (
    <Text style={[styles.text, variant !== 'primary' && styles.textDark, variant === 'light' && styles.textBrand]}>
      {children}
    </Text>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.shadow,
          { borderRadius: radius },
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { borderRadius: radius }]}
        >
          {label}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { borderRadius: radius },
        variant === 'secondary' ? styles.secondary : styles.lightVariant,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {label}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  shadow: {
    shadowColor: '#D6764C',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  lightVariant: {
    backgroundColor: colors.surfaceTint,
    borderWidth: 1.5,
    borderColor: '#F4CBAE',
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.9 },
  text: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  textDark: { color: colors.text },
  textBrand: { color: colors.primaryText },
});
