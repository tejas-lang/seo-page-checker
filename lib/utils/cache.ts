/**
 * A tiny in-memory cache with expiry.
 *
 * WHY: two people auditing two pages on the same site a minute apart should not
 * cause two downloads of the same robots.txt. Caching it is polite to the site
 * we are crawling and makes the second audit faster.
 *
 * LIMITATION, stated plainly: this lives in the memory of one server process.
 * Run several instances and each keeps its own copy. That is fine for a cache
 * (a miss just means one extra request) but it is NOT fine for anything that
 * must be consistent across instances — see the note in lib/rate-limit.ts.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    // Cheap bounded eviction: drop the oldest insertion when full. Map
    // preserves insertion order, so the first key is the oldest.
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }

    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Remove expired entries. Called opportunistically, not on a timer. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
