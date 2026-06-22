import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

export interface OptionsMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface OptionsMenuProps {
  visible: boolean;
  title?: string;
  options: OptionsMenuItem[];
  onClose: () => void;
}

export function OptionsMenu({ visible, title, options, onClose }: OptionsMenuProps) {
  const styles = useThemedStyles(createStyles);

  const handlePress = (option: OptionsMenuItem) => {
    onClose();
    option.onPress();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {options.map((option) => (
            <TouchableOpacity
              key={option.label}
              style={styles.option}
              onPress={() => handlePress(option)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Text
                style={[
                  styles.optionText,
                  option.destructive && styles.optionTextDestructive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.option, styles.cancelOption]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: BORDER_RADIUS.lg,
      borderTopRightRadius: BORDER_RADIUS.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.lg,
      paddingHorizontal: SPACING.md,
    },
    title: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    option: {
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    optionTextDestructive: {
      color: colors.danger,
    },
    cancelOption: {
      marginTop: SPACING.sm,
      borderBottomWidth: 0,
    },
    cancelText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
}
