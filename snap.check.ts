/** `npm run check` — where a released sheet drag lands. */
import assert from 'node:assert/strict';
import { nearestSnap } from './snap.ts';

// A 800pt container: collapsed sits 704 down, half 360, full 64.
const snaps = [704, 360, 64];

assert.equal(nearestSnap(704, snaps), 0, 'resting on a snap stays on it');
assert.equal(nearestSnap(360, snaps), 1);
assert.equal(nearestSnap(64, snaps), 2);

assert.equal(nearestSnap(700, snaps), 0, 'a slow drag lands where you let go');
assert.equal(nearestSnap(380, snaps), 1);

// Midpoint of collapsed and half is 532; either side of it picks the near one.
assert.equal(nearestSnap(540, snaps), 0, 'just below the midpoint stays collapsed');
assert.equal(nearestSnap(520, snaps), 1, 'just above it opens to half');

// A flick carries past the closest snap: released at half, but moving down
// 1400pt/s projects to 360 + 210 = 570, which is nearer collapsed.
assert.equal(nearestSnap(360, snaps, 1400), 0, 'a downward flick from half collapses');
assert.equal(nearestSnap(360, snaps, -1400), 2, 'an upward flick from half goes full');
assert.equal(nearestSnap(360, snaps, 200), 1, 'a gentle flick is not enough to change snap');

// Velocity must not overshoot the ends — the list is clamped by construction.
assert.equal(nearestSnap(64, snaps, -9000), 2, 'flicking up at the top stays at the top');
assert.equal(nearestSnap(704, snaps, 9000), 0, 'flicking down at the bottom stays put');

// Dragging beyond either end still resolves to the nearest real snap.
assert.equal(nearestSnap(-200, snaps), 2);
assert.equal(nearestSnap(1200, snaps), 0);

console.log('snap.ts ok');
