/** Account-local async resource with mutation invalidation and stale-response protection. */
export const createResourceCache = <T>(fetchValue: () => Promise<T>) => {
  let revision = 0;
  let value: T | undefined;
  let pending: Promise<T> | undefined;
  const listeners = new Set<() => void>();
  const cache = {
    get value() {
      return value;
    },
    get observed() {
      return listeners.size > 0;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    invalidate() {
      revision++;
      pending = undefined;
      listeners.forEach((fn) => fn());
    },
    read(): Promise<T> {
      if (pending) return pending;
      const generation = revision;
      const request: Promise<T> = fetchValue().then((result) => {
        // A write landed during the read. Its caller must receive a fresh result.
        if (generation !== revision) return cache.read();
        value = result;
        return result;
      }, (error) => {
        if (generation !== revision) return cache.read();
        throw error;
      }).finally(() => {
        if (pending === request) pending = undefined;
      });
      pending = request;
      return request;
    },
  };
  return cache;
};

export type ResourceCache<T> = ReturnType<typeof createResourceCache<T>>;
