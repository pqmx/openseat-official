import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createRoomCache } from './room-cache.ts';
import { createPlacesHandler } from './supabase/functions/places-search/handler.ts';

const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const requests: ReturnType<typeof deferred>[] = [];
const cache = createRoomCache(() => {
  const request = deferred(); requests.push(request); return request.promise;
});
assert.equal(await cache.read(), undefined, 'signed-out screens never fetch');
cache.reset('alice');
const alice = cache.read();
assert.equal(cache.read(), alice, 'mounted screens share an in-flight request');
cache.reset(undefined);
cache.reset('bob');
const bob = cache.read();
requests[0].resolve([{ id: 'alice-private-room' }]);
assert.equal(await alice, undefined, 'old account response is discarded');
assert.deepEqual(cache.rooms, []);
requests[1].resolve([{ id: 'bob-room' }]);
assert.deepEqual(await bob, [{ id: 'bob-room' }]);
const stale = cache.read();
cache.reset('alice');
requests[2].reject(new Error('old account network failure'));
assert.equal(await stale, undefined, 'old account failures do not poison new screens');
const failed = cache.read();
requests[3].reject(new Error('offline'));
await assert.rejects(failed, /offline/);
const retry = cache.read();
requests[4].resolve([]);
assert.deepEqual(await retry, [], 'failed reads can be retried');

const token = '11111111-1111-4111-8111-111111111111';
let authenticated = true;
let allowed: unknown = true;
let spendError: unknown = null;
let upstream: () => Promise<Response> = async () => Response.json({ suggestions: [] });
let calls = 0;
const spent: string[] = [];
const handler = createPlacesHandler({
  key: 'test-key',
  client: () => ({
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'alice' } : null } }) },
    rpc: async (name) => { spent.push(name); return { data: allowed, error: spendError }; },
  }),
  fetcher: async (_url, init) => { calls++; assert.ok(init?.signal); return upstream(); },
});
const post = (body: unknown, auth = true) => handler(new Request('https://example.test', {
  method: 'POST', headers: auth ? { Authorization: 'Bearer test' } : {}, body: JSON.stringify(body),
}));
assert.equal((await post({ q: 'Powell', session: token }, false)).status, 401);
authenticated = false;
assert.equal((await post({ q: 'Powell', session: token })).status, 401);
authenticated = true;
for (const body of [null, [], {}, { q: 'x', session: token }, { q: 'Powell', session: '../bad' },
  { placeId: '../secret', session: token }, { q: 'x'.repeat(5000), session: token }]) {
  assert.equal((await post(body)).status, 400);
}
assert.equal(calls, 0, 'invalid/unsigned requests never spend Google quota');
assert.equal(spent.length, 0, 'invalid requests never spend a user allowance');
allowed = false;
assert.equal((await post({ q: 'Powell', session: token })).status, 429);
assert.equal(calls, 0);
allowed = null;
assert.equal((await post({ q: 'Powell', session: token })).status, 429, 'quota must explicitly permit');
allowed = true;
spendError = new Error('database down');
assert.equal((await post({ placeId: 'abc', session: token })).status, 502);
assert.equal(calls, 0, 'counter errors fail closed');
spendError = null;
assert.equal((await post({ q: 'Powell', session: token })).status, 200);
assert.equal(spent.at(-1), 'spend_place_autocomplete');
upstream = async () => Response.json({ location: { latitude: 34.07, longitude: -118.44 } });
assert.deepEqual(await (await post({ placeId: 'abc', session: token })).json(), { lat: 34.07, lng: -118.44 });
assert.equal(spent.at(-1), 'spend_place_lookup');
upstream = async () => { throw new Error('private upstream credentials'); };
const failure = await post({ q: 'Powell', session: token });
assert.equal(failure.status, 502);
assert.ok(!(await failure.text()).includes('credentials'));
assert.equal((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 204);
assert.equal((await handler(new Request('https://example.test'))).status, 405);
console.log('security checks passed: account cache isolation and Places authorization/quotas');

// Run malformed assets in a subprocess: a regressed infinite loop must fail the
// test timeout, not hang CI. These exercise the patched build-time parsers.
execFileSync(process.execPath, ['-e', `
  const assert = require('node:assert/strict');
  const { ICNS } = require('image-size/dist/types/icns');
  const { JXL } = require('image-size/dist/types/jxl');
  const { HEIF } = require('image-size/dist/types/heif');
  const icns = Buffer.alloc(24); icns.write('icns'); icns.writeUInt32BE(24,4); icns.write('icp4',8);
  assert.throws(() => ICNS.calculate(icns), /entry length/);
  icns.writeUInt32BE(16,12);
  assert.equal(ICNS.calculate(icns).width,16);
  const jxl = Buffer.alloc(24); jxl.write('jxlp',4);
  try { JXL.calculate(jxl); } catch {}
  const heif = Buffer.alloc(24); heif.write('ftyp',4); heif.write('heic',8);
  assert.throws(() => HEIF.calculate(heif));
  assert.ok(require('image-size')('assets/icon.png').width > 0);
`], { timeout: 5000, cwd: process.cwd() });
const require = createRequire(import.meta.url);
const query = require('query-string');
assert.equal(query.parse('q=hello%20world').q, 'hello world');
execFileSync(process.execPath, ['-e', `require('query-string').parse('q=' + '%E0%A4%A'.repeat(10000));`], { timeout: 5000 });
console.log('dependency patches passed: malformed assets and deep-link decoding');
