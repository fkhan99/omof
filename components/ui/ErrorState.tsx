import { View, Text, StyleSheet } from 'react-native';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      {onRetry && <Button title="Try again" onPress={onRetry} variant="secondary" />}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.xl,
      backgroundColor: colors.dangerSoft,
      borderRadius: BORDER_RADIUS.md,
      margin: SPACING.md,
    },
    message: {
      fontSize: FONT_SIZES.md,
      color: colors.danger,
      textAlign: 'center',
      marginBottom: SPACING.md,
    },
  });
}
