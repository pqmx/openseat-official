import assert from 'node:assert/strict';
import { rooms, viewOf, you, type Room } from './data.ts';

/** `viewOf` decides which of the five drawings `/room/[id]` renders. */
const room = (over: Partial<Room>): Room => ({ ...rooms[0], hostId: 'other', attendees: [], ...over });

assert.equal(viewOf(room({ canceledAt: new Date() })), 'canceled');
// Canceled wins even over hosting — the room is gone for everyone.
assert.equal(viewOf(room({ canceledAt: new Date(), hostId: you.id })), 'canceled');
assert.equal(viewOf(room({ hostId: you.id, access: 'approve' })), 'requests');
assert.equal(viewOf(room({ hostId: you.id, access: 'open' })), 'host');
assert.equal(viewOf(room({ attendees: [you.id] })), 'member');
// In the room already? You see the pin, casual or not.
assert.equal(viewOf(room({ attendees: [you.id], casual: true })), 'member');
assert.equal(viewOf(room({ casual: true })), 'casual');
assert.equal(viewOf(room({})), 'member');

// Every fixture resolves to a screen app/room/[id].tsx can render.
for (const r of rooms) assert.ok(viewOf(r));

// Every room has a pin, and it lands in Westwood rather than the Gulf of
// Guinea — a swapped lat/lng or a dropped minus sign is the easy mistake.
for (const r of rooms) {
  assert.ok(r.lat > 34.06 && r.lat < 34.076, `${r.id} latitude off campus: ${r.lat}`);
  assert.ok(r.lng > -118.4535 && r.lng < -118.438, `${r.id} longitude off campus: ${r.lng}`);
  // North-west of this diagonal is Bel Air and the golf course, not campus —
  // the corner a plausible-looking pair of numbers actually lands in.
  assert.ok(!(r.lat > 34.0735 && r.lng < -118.445), `${r.id} is up in Bel Air`);
}

console.log('data.ts ok');
