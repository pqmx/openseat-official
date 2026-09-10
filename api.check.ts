import assert from 'node:assert/strict';
import { ROOM_REFRESH_MS } from './refresh.ts';
import { createResourceCache } from './resource-cache.ts';

// An active screen must not depend only on navigation, foregrounding, or a
// local write to learn about another device's changes. Keep that upper bound
// short enough to feel live without turning every label tick into a fetch.
assert.equal(ROOM_REFRESH_MS, 15_000);
assert.ok(ROOM_REFRESH_MS <= 15_000, 'active room data refreshes within 15 seconds plus request latency');
assert.ok(ROOM_REFRESH_MS >= 10_000, 'the rooms endpoint is not polled on every clock tick');

const deferred = () => {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const requests: ReturnType<typeof deferred>[] = [];
const cache = createResourceCache(() => {
  const request = deferred(); requests.push(request); return request.promise;
});
const initial = cache.read();
assert.equal(cache.read(), initial, 'same resource shares pending reads');
requests[0].resolve('initial');
assert.equal(await initial, 'initial');
let invalidations = 0;
const unsubscribe = cache.subscribe(() => invalidations++);
assert.equal(cache.observed, true);
const stale = cache.read();
cache.invalidate();
assert.equal(invalidations, 1);
const fresh = cache.read();
requests[2].resolve('after write');
assert.equal(await fresh, 'after write');
requests[1].resolve('before write');
// A slow response may cause another fresh read, but never returns its stale data.
await Promise.resolve();
requests[3].resolve('after write');
assert.equal(await stale, 'after write');
assert.equal(cache.value, 'after write');
const failure = cache.read();
requests[4].reject(new Error('offline'));
await assert.rejects(failure, /offline/);
assert.equal(cache.value, 'after write', 'transient failures preserve loaded data');
const retry = cache.read();
requests[5].resolve('reconnected');
assert.equal(await retry, 'reconnected');
unsubscribe();
assert.equal(cache.observed, false);
console.log('api checks passed: refresh cadence, deduplication, mutation races, retained data, retry');
