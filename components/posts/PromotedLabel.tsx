import { View, Text, StyleSheet } from 'react-native';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export function PromotedLabel() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel="Promoted post">
      <Text style={styles.text}>Promoted</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.accentSoft,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.sm,
      marginBottom: SPACING.xs,
    },
    text: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
  });
}
