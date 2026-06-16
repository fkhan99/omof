import { Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

/** Always-visible back control for stack headers. */
export function StackBackButton() {
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{ marginLeft: Platform.OS === 'ios' ? 4 : 8, padding: 4 }}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        size={Platform.OS === 'ios' ? 28 : 24}
        color={colors.text}
      />
    </TouchableOpacity>
  );
}
