import { memo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

interface RefreshGearProps {
  visible?: boolean;
  spinning?: boolean;
  pullProgress?: number;
  compact?: boolean;
}

function RefreshGearComponent({
  visible = true,
  spinning = true,
  pullProgress = 1,
  compact = false,
}: RefreshGearProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!spinning) {
      animationRef.current?.stop();
      animationRef.current = null;
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animationRef.current = animation;
    animation.start();

    return () => {
      animation.stop();
      animationRef.current = null;
    };
  }, [spinning, spin]);

  if (!visible) return null;

  const spinRotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const pullRotate = `${Math.max(0, Math.min(1, pullProgress)) * 360}deg`;

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        { opacity: spinning ? 1 : Math.max(0.35, pullProgress) },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={spinning ? 'Refreshing' : 'Pull to refresh'}
    >
      {spinning ? (
        <Animated.View style={[styles.iconWrap, Platform.OS === 'web' && styles.webSpin, { transform: [{ rotate: spinRotate }] }]}>
          <Ionicons name="sync" size={22} color={colors.primary} />
        </Animated.View>
      ) : (
        <View style={[styles.iconWrap, { transform: [{ rotate: pullRotate }] }]}>
          <Ionicons name="sync" size={22} color={colors.primary} />
        </View>
      )}
      {spinning ? <Text style={styles.label}>Refreshing...</Text> : null}
    </View>
  );
}

export const RefreshGear = memo(RefreshGearComponent);

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    containerCompact: {
      paddingVertical: SPACING.xs,
    },
    iconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    webSpin: Platform.OS === 'web'
      ? ({
          animationName: 'refreshGearSpin',
          animationDuration: '0.9s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        } as object)
      : {},
    label: {
      fontSize: 13,
      color: _colors.textMuted,
      fontWeight: '600',
    },
  });
}
