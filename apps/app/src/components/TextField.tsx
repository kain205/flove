import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, radii } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  icon?: ReactNode;
  helperText?: string;
}

export function TextField({ label, icon, helperText, style, multiline, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, multiline && styles.fieldMultiline]}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          placeholderTextColor={colors.mutedLight}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...props}
        />
      </View>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    color: colors.textSoft,
    fontWeight: '700',
    fontSize: 13,
  },
  helper: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 17,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  icon: { paddingTop: 1 },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
