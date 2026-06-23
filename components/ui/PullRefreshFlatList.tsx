import { useCallback, useEffect, useRef, useState } from 'react';
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

const PULL_THRESHOLD = 72;

type PullRefreshFlatListProps<T> = FlatListProps<T> & {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
};

export function PullRefreshFlatList<T>({
  refreshing,
  onRefresh,
  onScroll,
  ...rest
}: PullRefreshFlatListProps<T>) {
  const { colors } = useTheme();
  const scrollY = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const isDragging = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);

  useEffect(() => {
    if (!refreshing) {
      setPullDistance(0);
      touchStartY.current = null;
      isDragging.current = false;
    }
  }, [refreshing]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [onScroll],
  );

  const updatePullDistance = useCallback((pageY: number) => {
    if (refreshing || touchStartY.current == null) return;

    if (scrollY.current > 1) {
      touchStartY.current = null;
      isDragging.current = false;
      setPullDistance(0);
      return;
    }

    const delta = pageY - touchStartY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta, PULL_THRESHOLD * 1.5));
    } else {
      setPullDistance(0);
    }
  }, [refreshing]);

  const beginDrag = useCallback((pageY: number) => {
    if (refreshing || scrollY.current > 1) return;
    touchStartY.current = pageY;
    isDragging.current = true;
  }, [refreshing]);

  const endDrag = useCallback(() => {
    if (!isDragging.current) return;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      void onRefresh();
    } else if (!refreshing) {
      setPullDistance(0);
    }

    touchStartY.current = null;
    isDragging.current = false;
  }, [onRefresh, pullDistance, refreshing]);

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
            endDrag();
          },
          onMouseDown: (event: GestureResponderEvent) => {
            beginDrag(event.nativeEvent.pageY);
          },
          onMouseMove: (event: GestureResponderEvent) => {
            if (!isDragging.current) return;
            updatePullDistance(event.nativeEvent.pageY);
          },
          onMouseUp: () => {
            endDrag();
          },
          onMouseLeave: () => {
            if (isDragging.current) {
              endDrag();
            }
          },
        }
      : {};

  const showIndicator = refreshing || pullDistance > 8;
  const pullProgress = refreshing ? 1 : Math.min(1, pullDistance / PULL_THRESHOLD);
  const indicatorOffset = refreshing ? PULL_THRESHOLD * 0.35 : Math.min(pullDistance * 0.45, PULL_THRESHOLD * 0.45);

  return (
    <View style={styles.wrapper}>
      {showIndicator ? (
        <View
          style={[styles.indicator, { transform: [{ translateY: indicatorOffset }] }]}
          pointerEvents="none"
        >
          <RefreshGear spinning={refreshing} pullProgress={pullProgress} />
        </View>
      ) : null}
      <FlatList
        {...rest}
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
  indicator: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
});
