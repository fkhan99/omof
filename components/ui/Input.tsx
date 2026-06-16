import { TextInput, StyleSheet, TextInputProps, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, BORDER_RADIUS, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: object;
}

export function Input({ label, error, leftIcon, containerStyle, style, ...props }: InputProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={20}
            color={colors.textMuted}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          style={[styles.input, leftIcon && styles.inputWithIcon, error && styles.inputError, style]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label ?? props.placeholder}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: SPACING.md,
    },
    label: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginBottom: SPACING.xs,
      fontWeight: '600',
    },
    inputRow: {
      position: 'relative',
      justifyContent: 'center',
    },
    leftIcon: {
      position: 'absolute',
      left: SPACING.md,
      zIndex: 1,
    },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZES.md,
      color: colors.text,
      minHeight: 48,
    },
    inputWithIcon: {
      paddingLeft: SPACING.xl + SPACING.sm,
    },
    inputError: {
      borderColor: colors.danger,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.xs,
      marginTop: SPACING.xs,
    },
  });
}
