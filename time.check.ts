/** `npm run check` — the labels are the one bit of logic worth pinning down. */
import assert from 'node:assert/strict';
import { ago, clock, elapsed, when } from './time.ts';

const at = (iso: string) => new Date(iso);
const now = at('2026-09-12T21:15:00');

assert.equal(clock(at('2026-09-12T21:30:00')), '9:30 PM');
assert.equal(clock(at('2026-09-12T14:00:00')), '2 PM');
assert.equal(clock(at('2026-09-12T00:05:00')), '12:05 AM');
assert.equal(clock(at('2026-09-12T12:00:00')), '12 PM');

assert.equal(when(at('2026-09-12T21:30:00'), now), '9:30 PM', 'today is a bare time');
assert.equal(when(at('2026-09-13T14:00:00'), now), 'SUN 2 PM', 'this week gets a weekday');
// 00:30 tomorrow is 75 minutes away but still a different day — weekday, not bare time.
assert.equal(when(at('2026-09-13T00:30:00'), now), 'SUN 12:30 AM');
assert.equal(when(at('2026-09-30T14:00:00'), now), 'WED 9/30', 'further out gets a date');

assert.equal(elapsed(at('2026-09-12T20:53:00'), now), '22 MIN');
assert.equal(elapsed(at('2026-09-12T18:15:00'), now), '3 HR');
assert.equal(elapsed(at('2026-09-10T18:15:00'), now), '2 DAYS');
assert.equal(elapsed(at('2026-09-11T18:15:00'), now), '1 DAY');
assert.equal(elapsed(at('2026-09-12T21:20:00'), now), '0 MIN', 'the future never reads negative');

assert.equal(ago(at('2026-09-12T21:14:30'), now), 'just now');
assert.equal(ago(at('2026-09-12T21:13:00'), now), '2 min ago');
assert.equal(ago(at('2026-09-12T18:15:00'), now), '3 hr ago');
assert.equal(ago(at('2026-09-11T18:15:00'), now), 'yesterday');

console.log('time.ts ok');
