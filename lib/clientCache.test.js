import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedFetchJson, peekCache, prefetchJson, invalidateCache, isCacheFresh } from './clientCache.js';

function mockFetch(responses) {
  let calls = 0;
  global.fetch = async (url) => {
    calls++;
    const body = responses.shift();
    return { ok: true, json: async () => body };
  };
  return () => calls;
}

test('cachedFetchJson: caches and serves fresh data without refetching', async () => {
  const getCalls = mockFetch([{ v: 1 }]);
  const a = await cachedFetchJson('/x/1');
  const b = await cachedFetchJson('/x/1');
  assert.deepEqual(a, { v: 1 });
  assert.deepEqual(b, { v: 1 });
  assert.equal(getCalls(), 1); // second call served from cache, no network hit
});

test('cachedFetchJson: dedupes concurrent in-flight requests for the same URL', async () => {
  let resolveFetch;
  let calls = 0;
  global.fetch = () => {
    calls++;
    return new Promise((resolve) => {
      resolveFetch = () => resolve({ ok: true, json: async () => ({ v: 'dedup' }) });
    });
  };
  const p1 = cachedFetchJson('/x/2');
  const p2 = cachedFetchJson('/x/2');
  resolveFetch();
  const [a, b] = await Promise.all([p1, p2]);
  assert.deepEqual(a, { v: 'dedup' });
  assert.deepEqual(b, { v: 'dedup' });
  assert.equal(calls, 1);
});

test('cachedFetchJson: refetches once the TTL expires', async () => {
  const getCalls = mockFetch([{ v: 'old' }, { v: 'new' }]);
  const a = await cachedFetchJson('/x/3', { ttlMs: 10 });
  assert.deepEqual(a, { v: 'old' });
  await new Promise((r) => setTimeout(r, 20));
  const b = await cachedFetchJson('/x/3', { ttlMs: 10 });
  assert.deepEqual(b, { v: 'new' });
  assert.equal(getCalls(), 2);
});

test('peekCache: returns undefined before any fetch, and the cached value after', async () => {
  assert.equal(peekCache('/x/4'), undefined);
  mockFetch([{ v: 4 }]);
  await cachedFetchJson('/x/4');
  assert.deepEqual(peekCache('/x/4'), { v: 4 });
});

test('prefetchJson: warms the cache without throwing on failure', async () => {
  global.fetch = async () => { throw new Error('network down'); };
  await assert.doesNotReject(async () => {
    prefetchJson('/x/5');
    await new Promise((r) => setTimeout(r, 5));
  });
  assert.equal(peekCache('/x/5'), undefined);
});

test('invalidateCache: forces the next call to refetch even within the TTL window', async () => {
  const getCalls = mockFetch([{ v: 'a' }, { v: 'b' }]);
  await cachedFetchJson('/x/6', { ttlMs: 60_000 });
  assert.ok(isCacheFresh('/x/6', 60_000));
  invalidateCache('/x/6');
  assert.equal(peekCache('/x/6'), undefined);
  const b = await cachedFetchJson('/x/6', { ttlMs: 60_000 });
  assert.deepEqual(b, { v: 'b' });
  assert.equal(getCalls(), 2);
});
