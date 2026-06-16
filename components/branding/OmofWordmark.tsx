import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { BORDER_RADIUS, SPACING } from '@/constants/theme';

export function OmofWordmark() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.accentSoft,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="header"
      accessibilityLabel="OMOF"
    >
      <Text style={[styles.text, { color: colors.text }]}>OMOF</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: SPACING.md,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
});
