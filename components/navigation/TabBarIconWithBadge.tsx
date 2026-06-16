import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

type TabIconName = keyof typeof Ionicons.glyphMap;

interface TabBarIconWithBadgeProps {
  name: TabIconName;
  color: string;
  size?: number;
  badgeCount?: number;
}

export function TabBarIconWithBadge({
  name,
  color,
  size = 26,
  badgeCount = 0,
}: TabBarIconWithBadgeProps) {
  const { colors } = useTheme();
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <View style={styles.wrapper}>
      <Ionicons name={name} size={size} color={color} />
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
          <Text style={[styles.badgeText, { color: colors.white }]}>{badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 30,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
