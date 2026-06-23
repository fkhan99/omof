import { ReactNode } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  label: ReactNode;
  error?: string;
}

export function Checkbox({ checked, onToggle, label, error }: CheckboxProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.row}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={22}
          color={checked ? colors.link : colors.textMuted}
        />
        <View style={styles.label}>{typeof label === 'string' ? <Text style={styles.labelText}>{label}</Text> : label}</View>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginBottom: SPACING.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    label: {
      flex: 1,
    },
    labelText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    error: {
      color: colors.danger,
      fontSize: FONT_SIZES.sm,
      marginTop: SPACING.xs,
      marginLeft: 30,
    },
  });
}
