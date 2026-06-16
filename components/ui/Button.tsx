import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import { FONT_SIZES, BORDER_RADIUS, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  size = 'md',
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        isDisabled && styles.disabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    base: {
      borderRadius: BORDER_RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    danger: {
      backgroundColor: colors.danger,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.5,
    },
    size_sm: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      minHeight: 36,
      borderRadius: BORDER_RADIUS.full,
    },
    size_md: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      minHeight: 48,
      borderRadius: BORDER_RADIUS.md,
    },
    size_lg: {
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.xl,
      minHeight: 56,
      borderRadius: BORDER_RADIUS.md,
    },
    text: {
      fontWeight: '700',
    },
    text_primary: {
      color: colors.white,
    },
    text_secondary: {
      color: colors.text,
    },
    text_danger: {
      color: colors.white,
    },
    text_ghost: {
      color: colors.primary,
    },
    textSize_sm: {
      fontSize: FONT_SIZES.sm,
    },
    textSize_md: {
      fontSize: FONT_SIZES.md,
    },
    textSize_lg: {
      fontSize: FONT_SIZES.lg,
    },
  });
}
