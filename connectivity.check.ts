import assert from 'node:assert/strict';
import { checkConnection } from './connectivity-state.ts';

const online = await checkConnection(async () => new Response(null, { status: 204 }));
assert.equal(online, 'online', 'a successful reachability response is online');

const badStatus = await checkConnection(async () => new Response(null, { status: 503 }));
assert.equal(badStatus, 'offline', 'an unsuccessful reachability response is offline');

const rejected = await checkConnection(async () => {
  throw new TypeError('Network request failed');
});
assert.equal(rejected, 'offline', 'a rejected request is offline');

console.log('connectivity checks passed');
