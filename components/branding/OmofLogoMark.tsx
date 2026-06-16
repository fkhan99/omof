import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { BORDER_RADIUS, SHADOWS, SPACING } from '@/constants/theme';

type OmofLogoMarkProps = {
  size?: number;
};

export function OmofLogoMark({ size = 26 }: OmofLogoMarkProps) {
  const { colors } = useTheme();
  const frame = size + 12;

  return (
    <View
      style={[
        styles.frame,
        SHADOWS.sm,
        {
          width: frame,
          height: frame,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel="OMOF"
    >
      <View style={[styles.inner, { backgroundColor: colors.accentSoft }]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: size, height: size }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
