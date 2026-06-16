import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

export function PlusBadge({ compact = false }: { compact?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Ionicons name="star" size={compact ? 10 : 12} color={colors.warning} />
      <Text style={[styles.text, compact && styles.textCompact]}>Plus</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.warning + '22',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning + '55',
    },
    badgeCompact: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    text: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.warning,
    },
    textCompact: {
      fontSize: 10,
    },
  });
}
