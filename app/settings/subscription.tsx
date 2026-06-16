import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { startMockPlusTrial } from '@/services/firebase/subscriptions';
import { getUserProfile } from '@/services/firebase/auth';
import { PLANS } from '@/constants/plans';
import { Button } from '@/components/ui/Button';
import { PlusBadge } from '@/components/users/PlusBadge';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

export default function SubscriptionScreen() {
  const { profile, firebaseUser, setProfile } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const authUid = firebaseUser?.uid;

  const trialMutation = useMutation({
    mutationFn: () => startMockPlusTrial(authUid!),
    onSuccess: async () => {
      if (authUid) {
        const refreshed = await getUserProfile(authUid);
        if (refreshed) setProfile(refreshed);
      }
      Alert.alert(
        'OMOF Plus activated',
        'This is a mock trial for testing. No real payment was processed.',
      );
    },
    onError: (err) => {
      Alert.alert('Upgrade failed', err instanceof Error ? err.message : 'Try again.');
    },
  });

  if (!profile) return null;

  const isPlus = profile.plan === 'plus';
  const freePlan = PLANS.free;
  const plusPlan = PLANS.plus;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.mockBanner}>
        <Ionicons name="flask-outline" size={18} color={colors.warning} />
        <Text style={styles.mockBannerText}>
          MOCK / TEST ONLY — No real payments are processed.
        </Text>
      </View>

      <Text style={styles.title}>Subscription</Text>
      <Text style={styles.subtitle}>
        Current plan:{' '}
        <Text style={styles.planName}>{isPlus ? 'OMOF Plus' : 'Free'}</Text>
        {isPlus ? '  ' : null}
        {isPlus ? <PlusBadge compact /> : null}
      </Text>

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>{freePlan.name}</Text>
        <Text style={styles.planPrice}>{freePlan.priceLabel}</Text>
        <Text style={styles.planDescription}>{freePlan.description}</Text>
        {freePlan.features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
        {!isPlus ? (
          <Text style={styles.currentLabel}>Current plan</Text>
        ) : null}
      </View>

      <View style={[styles.planCard, styles.plusCard]}>
        <View style={styles.plusHeader}>
          <Text style={styles.planTitle}>{plusPlan.name}</Text>
          <PlusBadge />
        </View>
        <Text style={styles.planPrice}>{plusPlan.priceLabel}</Text>
        <Text style={styles.planDescription}>{plusPlan.description}</Text>
        {plusPlan.features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}

        {isPlus ? (
          <View style={styles.plusActive}>
            <Text style={styles.plusActiveText}>You have OMOF Plus</Text>
            <Text style={styles.creditsText}>
              {profile.promotionCredits} promotion credits remaining
            </Text>
          </View>
        ) : (
          <Button
            title={trialMutation.isPending ? 'Activating...' : 'Start OMOF Plus trial'}
            onPress={() => trialMutation.mutate()}
            loading={trialMutation.isPending}
            style={styles.trialButton}
          />
        )}
      </View>

      <Text style={styles.footnote}>
        Real billing integration (Stripe / App Store) will replace this mock flow in production.
      </Text>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    mockBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.warning + '18',
      borderWidth: 1,
      borderColor: colors.warning + '44',
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
    },
    mockBannerText: {
      flex: 1,
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.warning,
    },
    title: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
    },
    planName: {
      fontWeight: '700',
      color: colors.text,
    },
    planCard: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: SPACING.lg,
      gap: SPACING.sm,
    },
    plusCard: {
      borderColor: colors.warning + '66',
    },
    plusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    planTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    planPrice: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.primary,
    },
    planDescription: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    featureText: {
      flex: 1,
      fontSize: FONT_SIZES.sm,
      color: colors.text,
    },
    currentLabel: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: SPACING.sm,
    },
    plusActive: {
      marginTop: SPACING.sm,
      gap: SPACING.xs,
    },
    plusActiveText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.success,
    },
    creditsText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
    },
    trialButton: {
      marginTop: SPACING.sm,
    },
    footnote: {
      fontSize: FONT_SIZES.xs,
      color: colors.textMuted,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
  });
}
