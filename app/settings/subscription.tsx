import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { PLANS } from '@/constants/plans';
import { PlusBadge } from '@/components/users/PlusBadge';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';

export default function SubscriptionScreen() {
  const { profile } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  if (!profile) return null;

  const isPlus = profile.plan === 'plus';
  const freePlan = PLANS.free;
  const plusPlan = PLANS.plus;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.comingSoonBanner}>
        <Ionicons name="time-outline" size={18} color={colors.primary} />
        <Text style={styles.comingSoonText}>
          In-app subscriptions are coming soon. OMOF Plus will be available through the App Store
          when billing is enabled.
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
          <Text style={styles.unavailableText}>
            Upgrade will be available in a future update via the App Store.
          </Text>
        )}
      </View>
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
    comingSoonBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
      backgroundColor: colors.accentSoft + '44',
      borderWidth: 1,
      borderColor: colors.primary + '44',
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
    },
    comingSoonText: {
      flex: 1,
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      lineHeight: 20,
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
    unavailableText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textMuted,
      lineHeight: 20,
      marginTop: SPACING.sm,
    },
  });
}
