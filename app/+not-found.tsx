import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { FONT_SIZES, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export default function NotFoundScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn&apos;t exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.lg,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    link: {
      marginTop: SPACING.md,
      paddingVertical: SPACING.md,
    },
    linkText: {
      fontSize: FONT_SIZES.md,
      color: colors.link,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
  });
}
