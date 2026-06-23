import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
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
  ListHeaderComponent?: FlatListProps<unknown>['ListHeaderComponent'],
): ReactElement | null {
  if (!ListHeaderComponent) return null;

  return typeof ListHeaderComponent === 'function'
    ? <ListHeaderComponent />
    : ListHeaderComponent;
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
  const [pendingRefresh, setPendingRefresh] = useState(false);
  refreshingRef.current = refreshing;
  onRefreshRef.current = onRefresh;

  const isRefreshing = refreshing || pendingRefresh;

  const resetPullState = useCallback(() => {
    if (isRefreshing) return;
    touchStartY.current = null;
    isDragging.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, [isRefreshing]);

  const setPullDistanceSafe = useCallback((distance: number) => {
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  }, []);

  useEffect(() => {
    if (!refreshing) {
      setPendingRefresh(false);
      touchStartY.current = null;
      isDragging.current = false;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  }, [refreshing]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      scrollY.current = y;

      if (!isRefreshing && y > 1 && (pullDistanceRef.current > 0 || isDragging.current)) {
        touchStartY.current = null;
        isDragging.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }

      onScroll?.(event);
    },
    [isRefreshing, onScroll],
  );

  const updatePullDistance = useCallback(
    (pageY: number) => {
      if (isRefreshing || touchStartY.current == null || !isDragging.current) return;

      if (scrollY.current > 1) {
        touchStartY.current = null;
        isDragging.current = false;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const delta = pageY - touchStartY.current;
      if (delta > 0) {
        setPullDistanceSafe(Math.min(delta, PULL_THRESHOLD * 1.5));
      } else {
        setPullDistanceSafe(0);
      }
    },
    [isRefreshing, setPullDistanceSafe],
  );

  const beginDrag = useCallback(
    (pageY: number) => {
      if (isRefreshing || scrollY.current > 1) return;
      touchStartY.current = pageY;
      isDragging.current = true;
    },
    [isRefreshing],
  );

  const endDrag = useCallback(() => {
    if (!isDragging.current) return;

    const shouldRefresh =
      pullDistanceRef.current >= PULL_THRESHOLD && !refreshingRef.current && !pendingRefresh;

    touchStartY.current = null;
    isDragging.current = false;

    if (shouldRefresh) {
      setPendingRefresh(true);
      setPullDistanceSafe(0);
      void onRefreshRef.current();
      return;
    }

    resetPullState();
  }, [pendingRefresh, resetPullState, setPullDistanceSafe]);

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
            if (!isRefreshing) {
              resetPullState();
            }
          },
        }
      : {};

  const showRefreshBar =
    Platform.OS === 'web' && (isRefreshing || pullDistance > 8);

  const indicatorHeight = isRefreshing
    ? REFRESH_BAR_HEIGHT
    : pullDistance > 8
      ? Math.min(REFRESH_BAR_HEIGHT, Math.max(SPACING.lg, pullDistance * 0.55))
      : 0;

  const pullProgress = isRefreshing ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD);

  const combinedListHeader = useCallback(
    () => renderListHeader(ListHeaderComponent),
    [ListHeaderComponent],
  );

  return (
    <View style={styles.wrapper}>
      {showRefreshBar ? (
        <View style={[styles.refreshBar, { height: indicatorHeight }]}>
          <RefreshGear spinning={isRefreshing} pullProgress={pullProgress} compact />
        </View>
      ) : null}
      <FlatList
        {...rest}
        style={[styles.list, rest.style]}
        ListHeaderComponent={ListHeaderComponent ? combinedListHeader : undefined}
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
