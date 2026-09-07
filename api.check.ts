import assert from 'node:assert/strict';
import { ROOM_REFRESH_MS } from './refresh.ts';

// An active screen must not depend only on navigation, foregrounding, or a
// local write to learn about another device's changes. Keep that upper bound
// short enough to feel live without turning every label tick into a fetch.
assert.equal(ROOM_REFRESH_MS, 15_000);
assert.ok(ROOM_REFRESH_MS <= 15_000, 'active room data refreshes within 15 seconds plus request latency');
assert.ok(ROOM_REFRESH_MS >= 10_000, 'the rooms endpoint is not polled on every clock tick');

console.log('api refresh latency ok');
