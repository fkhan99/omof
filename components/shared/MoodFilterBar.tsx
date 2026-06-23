import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MOOD_TAGS, MoodTag } from '@/types';
import { SHARED_EXPERIENCES } from '@/constants/copy';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface MoodFilterBarProps {
  selectedMood: MoodTag | 'all' | 'growth';
  onSelect: (mood: MoodTag | 'all' | 'growth') => void;
}

export function MoodFilterBar({ selectedMood, onSelect }: MoodFilterBarProps) {
  const styles = useThemedStyles(createStyles);

  const chips: { id: MoodTag | 'all' | 'growth'; label: string }[] = [
    { id: 'all', label: SHARED_EXPERIENCES.allMoods },
    ...MOOD_TAGS.map((mood) => ({ id: mood, label: mood })),
    { id: 'growth', label: SHARED_EXPERIENCES.growthFilter },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={SHARED_EXPERIENCES.moodFilterLabel}
    >
      {chips.map((chip) => {
        const active = selectedMood === chip.id;
        return (
          <TouchableOpacity
            key={chip.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(chip.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
    },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.selectedBackground,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
}
