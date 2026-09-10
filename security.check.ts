import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createPlacesHandler } from './supabase/functions/places-search/handler.ts';

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
console.log('security checks passed: Places authorization/quotas');

// Expo's compatible patch upgrade removes image-size entirely. Fail if its
// vulnerable parser chain is reintroduced; iOS export verifies real app assets.
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.ok(!Object.keys(lock.packages).some((name) => name.endsWith('/image-size')),
  'image-size must not return to the build dependency graph');
const require = createRequire(import.meta.url);
const query = require('query-string');
assert.equal(query.parse('q=hello%20world').q, 'hello world');
execFileSync(process.execPath, ['-e', `require('query-string').parse('q=' + '%E0%A4%A'.repeat(10000));`], { timeout: 5000 });
console.log('dependency checks passed: vulnerable image parser absent and deep-link decoding bounded');
