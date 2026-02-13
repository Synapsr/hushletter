import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

type FavoriteSnapshot = {
  _id: string;
  isFavorited?: boolean;
};

interface OptimisticFavoriteController {
  getIsFavorited: (newsletterId: string, serverValue?: boolean) => boolean;
  isFavoritePending: (newsletterId: string) => boolean;
  toggleFavorite: (newsletterId: string, currentValue: boolean) => Promise<void>;
}

const DEFAULT_CLEAR_DELAY_MS = 1200;
const ERROR_CLEAR_DELAY_MS = 1800;

/**
 * Shared optimistic state controller for newsletter favorites.
 * - Immediate optimistic toggle for snappy interactions
 * - Per-newsletter pending lock
 * - Automatic rollback on mutation failure
 * - Auto-clear optimistic entries when server catches up or fallback timer fires
 */
export function useOptimisticNewsletterFavorite(
  newsletters: FavoriteSnapshot[],
): OptimisticFavoriteController {
  const setFavorite = useMutation(api.newsletters.setNewsletterFavorite);
  const [optimisticById, setOptimisticById] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearExistingTimer = useCallback((newsletterId: string) => {
    const existingTimer = clearTimersRef.current.get(newsletterId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      clearTimersRef.current.delete(newsletterId);
    }
  }, []);

  const scheduleOptimisticCleanup = useCallback(
    (newsletterId: string, delayMs: number) => {
      clearExistingTimer(newsletterId);
      const timer = setTimeout(() => {
        clearTimersRef.current.delete(newsletterId);
        setOptimisticById((prev) => {
          if (!prev.has(newsletterId)) return prev;
          const next = new Map(prev);
          next.delete(newsletterId);
          return next;
        });
      }, delayMs);
      clearTimersRef.current.set(newsletterId, timer);
    },
    [clearExistingTimer],
  );

  useEffect(() => {
    return () => {
      for (const timer of clearTimersRef.current.values()) {
        clearTimeout(timer);
      }
      clearTimersRef.current.clear();
    };
  }, []);

  const serverFavoriteMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const newsletter of newsletters) {
      map.set(newsletter._id, Boolean(newsletter.isFavorited));
    }
    return map;
  }, [newsletters]);

  useEffect(() => {
    if (optimisticById.size === 0) return;
    setOptimisticById((prev) => {
      let changed = false;
      const next = new Map(prev);

      for (const [newsletterId, optimisticValue] of prev) {
        if (pendingIds.has(newsletterId)) continue;
        const serverValue = serverFavoriteMap.get(newsletterId);
        if (serverValue !== undefined && serverValue === optimisticValue) {
          next.delete(newsletterId);
          clearExistingTimer(newsletterId);
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [optimisticById, pendingIds, serverFavoriteMap, clearExistingTimer]);

  const getIsFavorited = useCallback(
    (newsletterId: string, serverValue = false) => {
      return optimisticById.get(newsletterId) ?? serverValue;
    },
    [optimisticById],
  );

  const isFavoritePending = useCallback(
    (newsletterId: string) => pendingIds.has(newsletterId),
    [pendingIds],
  );

  const toggleFavorite = useCallback(
    async (newsletterId: string, currentValue: boolean) => {
      if (pendingIds.has(newsletterId)) return;

      const nextValue = !currentValue;
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.add(newsletterId);
        return next;
      });
      setOptimisticById((prev) => {
        const next = new Map(prev);
        next.set(newsletterId, nextValue);
        return next;
      });

      try {
        await setFavorite({
          userNewsletterId: newsletterId as Id<"userNewsletters">,
          isFavorited: nextValue,
        });
        scheduleOptimisticCleanup(newsletterId, DEFAULT_CLEAR_DELAY_MS);
      } catch (error) {
        setOptimisticById((prev) => {
          const next = new Map(prev);
          next.set(newsletterId, currentValue);
          return next;
        });
        scheduleOptimisticCleanup(newsletterId, ERROR_CLEAR_DELAY_MS);
        throw error;
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(newsletterId);
          return next;
        });
      }
    },
    [pendingIds, scheduleOptimisticCleanup, setFavorite],
  );

  return {
    getIsFavorited,
    isFavoritePending,
    toggleFavorite,
  };
}
