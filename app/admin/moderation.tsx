import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import {
  AdminModerationAction,
  fetchModerationQueue,
  ModerationQueueItem,
  performModerationAction,
} from '@/services/firebase/adminModeration';
import { FONT_SIZES, SPACING, BORDER_RADIUS, ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';

function QueueItem({
  item,
  onAction,
  isBusy,
}: {
  item: ModerationQueueItem;
  onAction: (action: AdminModerationAction) => void;
  isBusy: boolean;
}) {
  const styles = useThemedStyles(createItemStyles);

  return (
    <View style={styles.card}>
      <Text style={styles.meta}>
        {item.targetType.toUpperCase()} · @{item.authorUsername} · {item.reportCount} report(s)
      </Text>
      <Text style={styles.status}>
        {item.moderationStatus} · {(item.moderationConfidence * 100).toFixed(0)}% confidence
      </Text>
      <Text style={styles.reason}>{item.moderationReason}</Text>
      <Text style={styles.body} numberOfLines={6}>
        {item.text}
      </Text>
      <View style={styles.actions}>
        <Button title="Approve" onPress={() => onAction('approve')} disabled={isBusy} />
        <Button title="Reject" variant="secondary" onPress={() => onAction('reject')} disabled={isBusy} />
        <Button title="Spam" variant="ghost" onPress={() => onAction('mark_spam')} disabled={isBusy} />
        <Button title="Block" variant="ghost" onPress={() => onAction('mark_blocked')} disabled={isBusy} />
      </View>
    </View>
  );
}

export default function AdminModerationScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: items = [], isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['adminModerationQueue'],
    queryFn: () => fetchModerationQueue(40),
    enabled: profile?.isAdmin === true,
  });

  const actionMutation = useMutation({
    mutationFn: ({
      item,
      action,
    }: {
      item: ModerationQueueItem;
      action: AdminModerationAction;
    }) => performModerationAction(item.targetType, item.id, action),
    onMutate: ({ item }) => {
      setActiveId(`${item.targetType}:${item.id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminModerationQueue'] });
    },
    onError: (err) => {
      Alert.alert(
        'Action failed',
        err instanceof Error ? err.message : 'Could not update moderation status.',
      );
    },
    onSettled: () => {
      setActiveId(null);
    },
  });

  const handleAction = useCallback(
    (item: ModerationQueueItem, action: AdminModerationAction) => {
      const labels: Record<AdminModerationAction, string> = {
        approve: 'approve and publish this content',
        reject: 'reject and keep this content hidden',
        mark_spam: 'mark this as spam',
        mark_blocked: 'mark this as blocked',
      };

      Alert.alert('Confirm', `Are you sure you want to ${labels[action]}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: () => actionMutation.mutate({ item, action }),
        },
      ]);
    },
    [actionMutation],
  );

  if (!profile?.isAdmin) {
    return (
      <View style={styles.centered}>
        <Text style={styles.denied}>Admin access required.</Text>
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
    >
      <Text style={styles.title}>Moderation review queue</Text>
      <Text style={styles.subtitle}>
        Content hidden pending review. Authentic struggle should be approved; harmful content should
        be rejected.
      </Text>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} />
      ) : null}

      {isError ? (
        <View style={styles.centered}>
          <Text style={styles.error}>Could not load the review queue.</Text>
          <Button title="Retry" onPress={() => refetch()} />
        </View>
      ) : null}

      {!isLoading && !isError && items.length === 0 ? (
        <Text style={styles.empty}>No items awaiting review.</Text>
      ) : null}

      {items.map((item) => (
        <QueueItem
          key={`${item.targetType}:${item.id}`}
          item={item}
          onAction={(action) => handleAction(item, action)}
          isBusy={activeId === `${item.targetType}:${item.id}` && actionMutation.isPending}
        />
      ))}
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
    title: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: SPACING.sm,
    },
    loader: {
      marginTop: SPACING.xl,
    },
    empty: {
      fontSize: FONT_SIZES.md,
      color: colors.textMuted,
      marginTop: SPACING.lg,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    denied: {
      fontSize: FONT_SIZES.lg,
      color: colors.text,
      textAlign: 'center',
    },
    error: {
      fontSize: FONT_SIZES.md,
      color: colors.error,
      textAlign: 'center',
    },
  });
}

function createItemStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      gap: SPACING.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    meta: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    status: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.primary,
    },
    reason: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    body: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
      lineHeight: 22,
    },
    actions: {
      gap: SPACING.xs,
      marginTop: SPACING.sm,
    },
  });
}
