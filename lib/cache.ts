/**
 * A search costs 100 units of a 10,000 unit daily quota, so a default project
 * gets about 95 searches per day. Repeating a search should not spend another
 * 100 units, so identical queries are held in memory for a while.
 *
 * This is deliberately a process-local Map, not Redis. On a single instance it
 * removes almost all of the repeat cost. On a multi-instance deployment each
 * instance keeps its own copy, which is still a net win and needs no extra
 * service. If this app ever ran at real traffic, the cache moves to Redis and
 * the TTL moves to config.
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs = TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    // Oldest insertion first, which is what Map iteration order gives us.
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}
