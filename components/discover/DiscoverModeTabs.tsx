import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DISCOVER_MODES, DiscoverMode } from '@/constants/copy';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface DiscoverModeTabsProps {
  mode: DiscoverMode;
  onModeChange: (mode: DiscoverMode) => void;
}

const MODES: DiscoverMode[] = ['people', 'posts'];

export function DiscoverModeTabs({ mode, onModeChange }: DiscoverModeTabsProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {MODES.map((tab) => {
        const active = mode === tab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onModeChange(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={DISCOVER_MODES[tab].label}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {DISCOVER_MODES[tab].label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.sm,
      padding: 4,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    tabActive: {
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    tabText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
    },
  });
}
