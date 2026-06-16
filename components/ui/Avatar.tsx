import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { FONT_SIZES, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface AvatarProps {
  uri: string | null;
  size?: number;
  name?: string;
  showRing?: boolean;
}

export function Avatar({ uri, size = 40, name, showRing = false }: AvatarProps) {
  const styles = useThemedStyles(createStyles);
  const ringSize = size + (showRing ? 6 : 0);

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  const content = uri ? (
    <Image
      source={{ uri }}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
    />
  ) : (
    <View
      style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityLabel={name ? `${name}'s avatar` : 'Default avatar'}
    >
      <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );

  if (!showRing) return content;

  return (
    <View
      style={[
        styles.ring,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
        },
      ]}
    >
      {content}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    image: {
      backgroundColor: colors.surfaceMuted,
    },
    placeholder: {
      backgroundColor: colors.accentSoft,
      justifyContent: 'center',
      alignItems: 'center',
    },
    initials: {
      color: colors.primary,
      fontWeight: '700',
    },
    ring: {
      borderWidth: 2,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
