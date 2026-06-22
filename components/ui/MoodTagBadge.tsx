import { View, Text, StyleSheet } from 'react-native';
import { FONT_SIZES, BORDER_RADIUS, SPACING, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { MoodTag } from '@/types';

const MOOD_COLORS: Record<MoodTag, string> = {
  Frustrated: '#C4A882',
  Embarrassed: '#B8A0A8',
  Overwhelmed: '#9BA8B8',
  Lonely: '#8A9BA8',
  Disappointed: '#A8A090',
  Exhausted: '#A0A8A0',
  Anxious: '#B0A8B8',
  Other: '#9A9A9A',
};

interface MoodTagBadgeProps {
  mood: MoodTag;
}

export function MoodTagBadge({ mood }: MoodTagBadgeProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={[styles.badge, { backgroundColor: MOOD_COLORS[mood] + '33' }]}
      accessibilityRole="text"
      accessibilityLabel={`Mood: ${mood}`}
    >
      <Text style={[styles.text, { color: MOOD_COLORS[mood] }]}>{mood}</Text>
    </View>
  );
}

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      alignSelf: 'flex-start',
    },
    text: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
    },
  });
}
