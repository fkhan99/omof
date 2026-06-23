import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  FlatList,
  FlatListProps,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  GestureResponderEvent,
} from 'react-native';
import { RefreshGear } from '@/components/ui/RefreshGear';
import { useTheme } from '@/hooks/useTheme';
import { SPACING } from '@/constants/theme';

const PULL_THRESHOLD = 72;
const REFRESH_BAR_HEIGHT = 52;

type PullRefreshFlatListProps<T> = FlatListProps<T> & {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

function renderListHeader(
  pullHeader: ReactNode,
  ListHeaderComponent?: FlatListProps<unknown>['ListHeaderComponent'],
): ReactElement | null {
  const existing =
    typeof ListHeaderComponent === 'function'
      ? <ListHeaderComponent />
      : ListHeaderComponent ?? null;

  if (!pullHeader && !existing) return null;

  return (
    <>
      {pullHeader}
      {existing}
    </>
  );
}

export function PullRefreshFlatList<T>({
  refreshing,
  onRefresh,
  onScroll,
  ListHeaderComponent,
  ...rest
}: PullRefreshFlatListProps<T>) {
  const { colors } = useTheme();
  const scrollY = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const isDragging = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(refreshing);
  const onRefreshRef = useRef(onRefresh);
  const [pullDistance, setPullDistance] = useState(0);
  refreshingRef.current = refreshing;
  onRefreshRef.current = onRefresh;

  const resetPullState = useCallback(() => {
    touchStartY.current = null;
    isDragging.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, []);

  const setPullDistanceSafe = useCallback((distance: number) => {
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  }, []);

  useEffect(() => {
    if (!refreshing) {
      resetPullState();
    }
  }, [refreshing, resetPullState]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.current = y;

      if (y > 1 && (pullDistanceRef.current > 0 || isDragging.current)) {
        resetPullState();
      }

      onScroll?.(event);
    },
    [onScroll, resetPullState],
  );

  const updatePullDistance = useCallback(
    (pageY: number) => {
      if (refreshingRef.current || touchStartY.current == null || !isDragging.current) return;

      if (scrollY.current > 1) {
        resetPullState();
        return;
      }

      const delta = pageY - touchStartY.current;
      if (delta > 0) {
        setPullDistanceSafe(Math.min(delta, PULL_THRESHOLD * 1.5));
      } else {
        setPullDistanceSafe(0);
      }
    },
    [resetPullState, setPullDistanceSafe],
  );

  const beginDrag = useCallback(
    (pageY: number) => {
      if (refreshingRef.current || scrollY.current > 1) return;
      touchStartY.current = pageY;
      isDragging.current = true;
    },
    [],
  );

  const endDrag = useCallback(() => {
    if (!isDragging.current) return;

    const shouldRefresh =
      pullDistanceRef.current >= PULL_THRESHOLD && !refreshingRef.current;

    if (shouldRefresh) {
      void onRefreshRef.current();
    } else {
      resetPullState();
      return;
    }

    touchStartY.current = null;
    isDragging.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, [resetPullState]);

  const webPullHandlers =
    Platform.OS === 'web'
      ? {
          onTouchStart: (event: GestureResponderEvent) => {
            beginDrag(event.nativeEvent.pageY);
          },
          onTouchMove: (event: GestureResponderEvent) => {
            updatePullDistance(event.nativeEvent.pageY);
          },
          onTouchEnd: () => {
            endDrag();
          },
          onTouchCancel: () => {
            resetPullState();
          },
        }
      : {};

  const pullProgress = refreshing ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD);
  const indicatorHeight = refreshing
    ? REFRESH_BAR_HEIGHT
    : pullDistance > 8
      ? Math.min(REFRESH_BAR_HEIGHT, Math.max(SPACING.lg, pullDistance * 0.55))
      : 0;

  const pullHeader = useMemo(
    () =>
      Platform.OS === 'web' && indicatorHeight > 0 ? (
        <View style={[styles.refreshBar, { height: indicatorHeight }]}>
          <RefreshGear spinning={refreshing} pullProgress={pullProgress} compact />
        </View>
      ) : null,
    [indicatorHeight, pullProgress, refreshing],
  );

  const combinedListHeader = useCallback(
    () => renderListHeader(pullHeader, ListHeaderComponent),
    [ListHeaderComponent, pullHeader],
  );

  return (
    <View style={styles.wrapper}>
      <FlatList
        {...rest}
        style={[styles.list, rest.style]}
        ListHeaderComponent={combinedListHeader}
        {...webPullHandlers}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          Platform.OS !== 'web' ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  refreshBar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
});
