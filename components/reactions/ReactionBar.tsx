import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REACTION_TYPES, REACTION_LABELS, ReactionType } from '@/types';
import { SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

const REACTION_ICONS: Record<ReactionType, keyof typeof Ionicons.glyphMap> = {
  relate: 'heart-outline',
  been_there: 'hand-left-outline',
  sending_support: 'paper-plane-outline',
};

interface ReactionBarProps {
  userReaction: ReactionType | null;
  onReact: (type: ReactionType) => void;
}

export function ReactionBar({ userReaction, onReact }: ReactionBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {REACTION_TYPES.map((type) => {
        const isActive = userReaction === type;
        return (
          <TouchableOpacity
            key={type}
            style={[styles.reaction, isActive && styles.reactionActive]}
            onPress={() => onReact(type)}
            accessibilityRole="button"
            accessibilityLabel={REACTION_LABELS[type]}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={REACTION_ICONS[type]}
              size={22}
              color={isActive ? colors.primary : colors.textSecondary}
            />
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
      alignItems: 'center',
      justifyContent: 'center',
      width: 40,
      height: 40,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surfaceMuted,
    },
    reactionActive: {
      backgroundColor: colors.accentSoft,
    },
  });
}
