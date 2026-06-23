import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { REACTION_TYPES, REACTION_LABELS, ReactionType } from '@/types';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { ReactionIcon } from '@/components/reactions/ReactionIcon';

interface ReactionBarProps {
  userReaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
  disabled?: boolean;
}

export function ReactionBar({ userReaction, onReact, disabled = false }: ReactionBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {REACTION_TYPES.map((type) => {
        const isActive = userReaction === type;
        const iconColor = isActive ? colors.selected : colors.textSecondary;

        return (
          <TouchableOpacity
            key={type}
            style={[styles.reaction, isActive && styles.reactionActive, disabled && styles.reactionDisabled]}
            onPress={() => !disabled && onReact(type)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              isActive ? `Remove ${REACTION_LABELS[type]}` : REACTION_LABELS[type]
            }
            accessibilityState={{ selected: isActive }}
          >
            <ReactionIcon type={type} size={22} color={iconColor} />
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {REACTION_LABELS[type]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    reaction: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      gap: SPACING.xs,
    },
    reactionActive: {
      backgroundColor: colors.selectedBackground,
      borderColor: colors.selectedBorder,
      borderWidth: 2,
      paddingVertical: SPACING.sm - 1,
      paddingHorizontal: SPACING.xs - 1,
    },
    label: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    labelActive: {
      color: colors.selected,
      fontWeight: '700',
    },
    containerDisabled: {
      opacity: 0.45,
    },
    reactionDisabled: {
      opacity: 0.8,
    },
  });
}
