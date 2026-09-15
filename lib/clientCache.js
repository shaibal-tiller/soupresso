// Minimal in-memory cache for GET JSON requests, scoped to the browser tab's
// lifetime (a hard reload starts empty; nothing here is persisted). This is a
// speed layer only — every cache entry comes from a real server response, and
// a cache hit still triggers a background revalidation once it goes stale, so
// numbers can never be silently wrong for longer than `ttlMs`.
//
// Concurrent calls for the same URL share one in-flight request (dedup),
// so e.g. switching tabs back and forth doesn't pile up duplicate fetches.

const cache = new Map(); // url -> { data, ts }
const inflight = new Map(); // url -> Promise<data>

const DEFAULT_TTL_MS = 30_000;

export function peekCache(url) {
  const entry = cache.get(url);
  return entry ? entry.data : undefined;
}

export function isCacheFresh(url, ttlMs = DEFAULT_TTL_MS) {
  const entry = cache.get(url);
  return !!entry && Date.now() - entry.ts < ttlMs;
}

// Resolves with the cached value immediately if it's still fresh; otherwise
// fetches (deduped against any identical in-flight request), caches, and
// resolves with the fresh value.
export async function cachedFetchJson(url, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (isCacheFresh(url, ttlMs)) {
    return cache.get(url).data;
  }
  if (!inflight.has(url)) {
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        cache.set(url, { data, ts: Date.now() });
        return data;
      })
      .finally(() => inflight.delete(url));
    inflight.set(url, promise);
  }
  return inflight.get(url);
}

// Fire-and-forget cache warm-up for a URL the UI isn't waiting on yet (e.g.
// the adjacent day, or an unselected range tab). Failures are swallowed —
// a failed speculative prefetch just means the real request runs normally
// later, same as if nothing had been cached at all.
export function prefetchJson(url, opts) {
  cachedFetchJson(url, opts).catch(() => {});
}

export function invalidateCache(url) {
  cache.delete(url);
}

// Schedules `fn` for idle time (adjacent-day/tab prefetching should never
// compete with the request the user is actually waiting on). Falls back to
// a short timeout where requestIdleCallback isn't available (Safari).
export function runWhenIdle(fn) {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 300);
  }
}
