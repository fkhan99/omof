import { useCallback, useRef, useState } from 'react';

const MIN_REFRESH_MS = 450;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function usePullToRefresh(refreshFn: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshFnRef = useRef(refreshFn);
  const refreshingRef = useRef(false);
  refreshFnRef.current = refreshFn;

  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    setRefreshing(true);
    const started = Date.now();

    try {
      await refreshFnRef.current();
    } finally {
      const remaining = MIN_REFRESH_MS - (Date.now() - started);
      if (remaining > 0) {
        await delay(remaining);
      }
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  return { refreshing, onRefresh };
}
