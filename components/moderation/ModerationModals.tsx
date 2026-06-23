import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { CRISIS_RESOURCES } from '@/constants/safety';
import { MODERATION_COPY, MODERATION_REFLECTION_PROMPTS } from '@/constants/moderation';
import { useState } from 'react';
import { ModerationReflectionAnswers } from '@/types/moderation';

interface ModerationBlockedModalProps {
  visible: boolean;
  message?: string;
  onClose: () => void;
}

export function ModerationBlockedModal({
  visible,
  message = MODERATION_COPY.blocked,
  onClose,
}: ModerationBlockedModalProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Please revise</Text>
          <Text style={styles.message}>{message}</Text>
          <Button title="Edit content" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

interface ModerationSupportModalProps {
  visible: boolean;
  onEdit: () => void;
  onSubmitForReview: () => void;
}

export function ModerationSupportModal({
  visible,
  onEdit,
  onSubmitForReview,
}: ModerationSupportModalProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onEdit}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>{MODERATION_COPY.supportTitle}</Text>
          <Text style={styles.message}>{MODERATION_COPY.supportMessage}</Text>
          <ScrollView style={styles.resources}>
            {CRISIS_RESOURCES.map((resource) => (
              <TouchableOpacity
                key={resource.name}
                style={styles.resourceItem}
                onPress={() => {
                  void Linking.openURL(resource.action).catch(() => undefined);
                }}
              >
                <Text style={styles.resourceName}>{resource.name}</Text>
                <Text style={styles.resourceContact}>{resource.contact}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Button title="Edit content" onPress={onEdit} />
            <Button title="Submit for review" variant="secondary" onPress={onSubmitForReview} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ModerationGrowthModalProps {
  visible: boolean;
  onCancel: () => void;
  onContinue: (reflection: ModerationReflectionAnswers) => void;
}

export function ModerationGrowthModal({
  visible,
  onCancel,
  onContinue,
}: ModerationGrowthModalProps) {
  const styles = useThemedStyles(createStyles);
  const [whatHappened, setWhatHappened] = useState('');
  const [supportLookingFor, setSupportLookingFor] = useState('');
  const [hopingToImprove, setHopingToImprove] = useState('');

  const handleContinue = () => {
    onContinue({
      whatHappened: whatHappened.trim(),
      supportLookingFor: supportLookingFor.trim(),
      hopingToImprove: hopingToImprove.trim(),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.modal}>
            <Text style={styles.title}>{MODERATION_COPY.needsGrowthTitle}</Text>
            <Text style={styles.message}>{MODERATION_COPY.needsGrowthMessage}</Text>
            <Input
              label={MODERATION_REFLECTION_PROMPTS.whatHappened}
              value={whatHappened}
              onChangeText={setWhatHappened}
              multiline
            />
            <Input
              label={MODERATION_REFLECTION_PROMPTS.supportLookingFor}
              value={supportLookingFor}
              onChangeText={setSupportLookingFor}
              multiline
            />
            <Input
              label={MODERATION_REFLECTION_PROMPTS.hopingToImprove}
              value={hopingToImprove}
              onChangeText={setHopingToImprove}
              multiline
            />
            <View style={styles.actions}>
              <Button
                title="Continue"
                onPress={handleContinue}
                disabled={!whatHappened.trim() || !supportLookingFor.trim() || !hopingToImprove.trim()}
              />
              <Button title="Edit original" variant="ghost" onPress={onCancel} />
            </View>
          </View>
        </ScrollView>
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
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.sm,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
    },
    message: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    resources: {
      maxHeight: 150,
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
      marginTop: SPACING.sm,
    },
  });
}
