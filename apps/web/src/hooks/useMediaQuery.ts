import { useState, useEffect, useSyncExternalStore } from "react";

/**
 * Hook that tracks whether a CSS media query matches.
 * Uses useSyncExternalStore for a synchronous initial read on the client,
 * preventing a flash where isDesktop is false on first render.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  };

  const getSnapshot = () => window.matchMedia(query).matches;
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
