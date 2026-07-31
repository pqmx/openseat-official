import assert from 'node:assert/strict';
import {
  hostOf,
  matchesQuery,
  roomById,
  rooms,
  showsExactPin,
  viewOf,
  you,
  type Room,
} from './data.ts';

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

// A room you can't find is missing, not the first one in the list. The old
// fallback rendered rooms[0] for any bad id, so a stale link looked like a hit.
assert.equal(roomById('does-not-exist'), undefined);
assert.equal(roomById(rooms[0].id)?.id, rooms[0].id);

// An unknown host must never resolve to the viewer — that used to claim you
// hosted a room you'd never opened.
const orphan = room({ hostId: 'nobody' });
assert.notEqual(hostOf(orphan).id, you.id);
assert.equal(hostOf(orphan).short, 'Someone');
assert.equal(hostOf(rooms[0]).id, rooms[0].hostId);

// Casual rooms keep their address private until you're in the room.
assert.equal(showsExactPin(room({ casual: true, attendees: [] })), false);
assert.equal(showsExactPin(room({ casual: true, attendees: [you.id] })), true);
assert.equal(showsExactPin(room({ casual: false, attendees: [] })), true);

// Search reaches the three fields a room is findable by, and the limits bite.
const diddy = room({ title: 'Diddy Riese run', place: 'Outside Diddy Riese', street: 'Broxton Ave' });
assert.equal(matchesQuery(diddy, { text: 'broxton' }), true, 'street is searchable');
assert.equal(matchesQuery(diddy, { text: 'outside' }), true, 'place is searchable');
assert.equal(matchesQuery(diddy, { text: 'RIESE' }), true, 'case-insensitive');
assert.equal(matchesQuery(diddy, { text: 'powell' }), false);
assert.equal(matchesQuery(diddy, { text: '   ' }), true, 'blank text is not a filter');
assert.equal(matchesQuery(room({ walkMinutes: 6 }), { maxWalk: 6 }), true, 'maxWalk is inclusive');
assert.equal(matchesQuery(room({ walkMinutes: 7 }), { maxWalk: 6 }), false);
assert.equal(matchesQuery(room({ capacity: 2, attendees: ['a', 'b'] }), { openOnly: true }), false);
assert.equal(matchesQuery(room({ capacity: 3, attendees: ['a', 'b'] }), { openOnly: true }), true);

console.log('data.ts ok');
