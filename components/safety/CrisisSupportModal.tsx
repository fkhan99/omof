import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { CRISIS_RESOURCES } from '@/constants/safety';
import { Button } from '@/components/ui/Button';

interface CrisisSupportModalProps {
  visible: boolean;
  onEdit: () => void;
  onDismiss: () => void;
}

export function CrisisSupportModal({ visible, onEdit, onDismiss }: CrisisSupportModalProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title} accessibilityRole="header">
            You matter
          </Text>
          <Text style={styles.message}>
            It sounds like you may be going through something really difficult. OMOF is a
            supportive community, but we are not a crisis service or mental health provider.
          </Text>
          <Text style={styles.message}>
            If you are in crisis or thinking about harming yourself, please reach out for help
            right away.
          </Text>

          <ScrollView style={styles.resources}>
            {CRISIS_RESOURCES.map((resource) => (
              <TouchableOpacity
                key={resource.name}
                style={styles.resourceItem}
                onPress={() => {
                  void Linking.openURL(resource.action).catch(() => {
                    // Device may not support the scheme (e.g. no SIM for tel:).
                  });
                }}
                accessibilityRole="link"
                accessibilityLabel={`${resource.name}. ${resource.contact}`}
              >
                <Text style={styles.resourceName}>{resource.name}</Text>
                <Text style={styles.resourceContact}>{resource.contact}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Button title="Edit my caption" onPress={onEdit} />
            <Button title="Cancel post" variant="ghost" onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      maxHeight: '80%',
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.md,
    },
    message: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.md,
    },
    resources: {
      maxHeight: 150,
      marginBottom: SPACING.md,
    },
    resourceItem: {
      padding: SPACING.md,
      backgroundColor: colors.surfaceMuted,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.sm,
    },
    resourceName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.text,
    },
    resourceContact: {
      fontSize: FONT_SIZES.sm,
      color: colors.primary,
      marginTop: SPACING.xs,
    },
    actions: {
      gap: SPACING.sm,
    },
  });
}
