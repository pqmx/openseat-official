import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createResourceCache } from './resource-cache';
import { ROOM_REFRESH_MS } from './refresh';
import { supabase } from './supabase';

let identity: string | undefined;
const identityListeners = new Set<() => void>();
const resources = new Map<string, ReturnType<typeof createResourceCache<any>>>();
const subscribeIdentity = (fn: () => void) => { identityListeners.add(fn); return () => { identityListeners.delete(fn); }; };
const getIdentity = () => identity;
supabase.auth.onAuthStateChange((_event, session) => {
  if (identity === session?.user.id) return;
  identity = session?.user.id;
  resources.clear();
  identityListeners.forEach((fn) => fn());
});

export const invalidateRooms = () => { resources.forEach((resource) => resource.invalidate()); };

/** Loaded data survives transient refresh failures; account changes never reuse it. */
export const useRoomResource = <T>(key: string, fetchValue: () => Promise<T>) => {
  const userId = useSyncExternalStore(subscribeIdentity, getIdentity);
  const cache = useMemo(() => {
    const id = `${userId ?? 'signed-out'}:${key}`;
    let resource = resources.get(id);
    if (!resource) {
      // Bound retained history without evicting a screen's subscribed resource.
      for (const [oldKey, old] of resources) {
        if (resources.size < 30) break;
        if (!old.observed) resources.delete(oldKey);
      }
      resource = createResourceCache(fetchValue);
      resources.set(id, resource);
    }
    return resource as ReturnType<typeof createResourceCache<T>>;
  }, [key, userId, fetchValue]);
  const [state, setState] = useState<{ cache: typeof cache; data?: T; error?: unknown; busy: boolean }>(
    { cache, data: cache.value, busy: true },
  );
  const focused = useRef(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    if (!userId) return;
    setState((old) => ({ cache, data: old.cache === cache ? old.data : cache.value, busy: true }));
    try {
      const data = await cache.read();
      if (request === generation.current) setState({ cache, data, busy: false });
    } catch (error) {
      if (request === generation.current) setState((old) => ({ cache,
        data: old.cache === cache ? old.data : cache.value, error, busy: false }));
    }
  }, [cache, userId]);
  useEffect(() => () => { generation.current++; }, [cache]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void reload();
    const interval = setInterval(() => { if (AppState.currentState === 'active') void reload(); }, ROOM_REFRESH_MS);
    const subscription = cache.subscribe(() => { if (focused.current && AppState.currentState === 'active') void reload(); });
    const appState = AppState.addEventListener('change', (next) => { if (next === 'active') void reload(); });
    return () => { focused.current = false; clearInterval(interval); subscription(); appState.remove(); };
  }, [cache, reload]));
  const current = state.cache === cache ? state : { data: cache.value, error: undefined, busy: true };
  return { data: userId ? current.data : undefined, error: current.error, refreshing: current.busy,
    loading: current.data === undefined && current.busy, reload, userId };
};
