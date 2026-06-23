import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Button } from '@/components/ui/Button';

interface WelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const WELCOME_POINTS = [
  {
    title: 'Share what’s real',
    body: 'OMOF is for honest moments — struggles, setbacks, and small wins. You don’t need a highlight reel here.',
  },
  {
    title: 'Support, don’t judge',
    body: 'Use reactions and kind comments to let people know they’re not alone. Meet others with empathy, not advice they didn’t ask for.',
  },
  {
    title: 'Your space, your pace',
    body: 'Follow people who resonate with you, share when you’re ready, and keep your account private if you prefer.',
  },
  {
    title: 'We’re a community, not a crisis line',
    body: 'OMOF can be supportive, but it isn’t emergency or professional mental health care. If you’re in crisis, please reach out to local help.',
  },
] as const;

export function WelcomeModal({ visible, onDismiss }: WelcomeModalProps) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  const openGuidelines = () => {
    onDismiss();
    router.push('/settings/community-guidelines');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message"
        />
        <View style={styles.modal}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.title} accessibilityRole="header">
              Welcome to OMOF
            </Text>
            <Text style={styles.intro}>
              You’re in. Here’s what makes this community different:
            </Text>

            {WELCOME_POINTS.map((point) => (
              <View key={point.title} style={styles.point}>
                <Text style={styles.pointTitle}>{point.title}</Text>
                <Text style={styles.pointBody}>{point.body}</Text>
              </View>
            ))}

            <Pressable
              onPress={openGuidelines}
              accessibilityRole="link"
              accessibilityLabel="Read community guidelines"
            >
              <Text style={styles.link}>Read the community guidelines</Text>
            </Pressable>
          </ScrollView>

          <Button title="Got it" onPress={onDismiss} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      padding: SPACING.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modal: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      maxHeight: '85%',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    scrollContent: {
      paddingBottom: SPACING.sm,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '800',
      color: colors.text,
      marginBottom: SPACING.sm,
      textAlign: 'center',
    },
    intro: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.lg,
      textAlign: 'center',
    },
    point: {
      marginBottom: SPACING.md,
    },
    pointTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    pointBody: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    link: {
      fontSize: FONT_SIZES.sm,
      color: colors.link,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: SPACING.xs,
      marginBottom: SPACING.md,
    },
    button: {
      marginTop: SPACING.sm,
    },
  });
}
