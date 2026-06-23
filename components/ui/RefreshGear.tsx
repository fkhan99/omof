import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface RefreshGearProps {
  visible: boolean;
}

function RefreshGearComponent({ visible }: RefreshGearProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [visible, spin]);

  if (!visible) return null;

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Refreshing">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons name="sync" size={22} color={colors.primary} />
      </Animated.View>
      <Text style={styles.label}>Refreshing...</Text>
    </View>
  );
}

export const RefreshGear = memo(RefreshGearComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    label: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
}
