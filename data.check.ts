import assert from 'node:assert/strict';
import {
  feedFor,
  hostOf,
  isIn,
  matchesQuery,
  myRooms,
  roomById,
  seatsLeft,
  asMapsApp,
  interestTags,
  mapsUrl,
  maxInterests,
  promptQuestions,
  showsExactPin,
  viewOf,
  withAnswer,
  type Person,
  type Room,
} from './data.ts';

/**
 * `data.ts` is pure, so these run on constructed rows rather than fixtures.
 * The viewer is an argument now — that is the point of the change, and these
 * assertions are what stop it silently reverting to a single hardcoded person.
 */

const person = (id: string, over: Partial<Person> = {}): Person => ({
  id,
  initials: id.toUpperCase().slice(0, 2),
  short: id,
  name: id,
  year: "'27",
  major: 'Undeclared',
  ...over,
});

const me = person('me');
const other = person('other');

const room = (over: Partial<Room> = {}): Room => ({
  id: 'r1',
  title: 'Sunset set on Lot D roof',
  place: 'Lot D rooftop, level 5',
  approxLat: 34.07,
  approxLng: -118.442,
  lat: 34.0701,
  lng: -118.4421,
  host: other,
  startsAt: new Date('2026-01-01T20:00:00Z'),
  capacity: 18,
  access: 'open',
  attendees: [],
  requests: [],
  updates: [],
  ...over,
});

/** `viewOf` decides which of the five drawings `/room/[id]` renders. */
assert.equal(viewOf(room({ canceledAt: new Date() }), me), 'canceled');
// Canceled wins even over hosting — the room is gone for everyone.
assert.equal(viewOf(room({ canceledAt: new Date(), host: me }), me), 'canceled');
assert.equal(viewOf(room({ host: me, access: 'approve' }), me), 'requests');
assert.equal(viewOf(room({ host: me, access: 'open' }), me), 'host');
assert.equal(viewOf(room({ attendees: [me] }), me), 'member');
// In the room already? You see the pin, casual or not.
assert.equal(viewOf(room({ attendees: [me], casual: true }), me), 'member');
assert.equal(viewOf(room({ casual: true }), me), 'casual');
assert.equal(viewOf(room(), me), 'member');

// The same room reads differently for two people. This is what a module-level
// `you` could never express, and why identity had to become an argument.
const hosted = room({ host: me, attendees: [me] });
assert.equal(viewOf(hosted, me), 'host');
assert.equal(viewOf(hosted, other), 'member');
assert.equal(isIn(hosted, me), true);
assert.equal(isIn(hosted, other), false);

// A room you can't find is missing, not the first one in the list. The old
// fallback rendered rooms[0] for any bad id, so a stale link looked like a hit.
const all = [room({ id: 'a' }), room({ id: 'b' })];
assert.equal(roomById(all, 'does-not-exist'), undefined);
assert.equal(roomById(all, 'b')?.id, 'b');

// The room carries its host, so a room can no longer credit the wrong person.
assert.equal(hostOf(room({ host: other })).id, 'other');

/*
 * The pin is now whatever the server sent. `room_pins` has its own RLS policy,
 * so a casual room you haven't joined arrives with no coordinates at all —
 * these assert the client reads that absence rather than re-deriving the rule
 * from `casual`, which is what let the map contradict the database before.
 */
assert.equal(showsExactPin(room({ casual: true, lat: undefined, lng: undefined })), false);
assert.equal(showsExactPin(room({ casual: true })), true, 'a joined casual room has its pin');
assert.equal(showsExactPin(room({ casual: false })), true);
// Coarse coordinates always survive, so the map can still draw the circle.
assert.equal(room({ lat: undefined, lng: undefined }).approxLat, 34.07);

// No filters set is not a filter — an empty panel must not empty the feed.
assert.equal(matchesQuery(room(), {}), true);

const two = [person('a'), person('b')];
assert.equal(seatsLeft(room({ capacity: 2, attendees: two })), 0);
assert.equal(matchesQuery(room({ capacity: 2, attendees: two }), { openOnly: true }), false);
assert.equal(matchesQuery(room({ capacity: 3, attendees: two }), { openOnly: true }), true);

/*
 * `feedFor` still filters by year even though `rooms_select` in the database
 * already refuses to send a room your year can't see. Belt and braces: this
 * asserts the client half, so the sort stays correct if it ever runs against
 * rows nobody filtered.
 */
const past = new Date('2026-01-01T21:00:00Z');
const gated = room({ id: 'gated', years: ["'27"] });
const openToAll = room({ id: 'open' });
assert.deepEqual(
  feedFor([gated, openToAll], "'27", past).map((r) => r.id),
  ['gated', 'open'],
);
assert.deepEqual(
  feedFor([gated, openToAll], "'29", past).map((r) => r.id),
  ['open'],
  "a year-restricted room is absent for other years, never greyed out",
);
// Canceled rooms leave the feed entirely.
assert.deepEqual(feedFor([room({ canceledAt: new Date() })], "'27", past), []);

// Live first, most recently started leading; upcoming last, soonest first.
// This used to sort live rooms by `walkMinutes`, which was the same number on
// every room — the assertion passed on insertion order and proved nothing.
const started = room({ id: 'started', startsAt: new Date('2026-01-01T19:00:00Z') });
const justStarted = room({ id: 'justStarted', startsAt: new Date('2026-01-01T19:59:00Z') });
const later = room({ id: 'later', startsAt: new Date('2026-01-02T20:00:00Z') });
assert.deepEqual(
  feedFor([later, started, justStarted], "'27", past).map((r) => r.id),
  ['justStarted', 'started', 'later'],
);

// The Rooms tab is only what you're actually in.
assert.deepEqual(
  myRooms([room({ id: 'mine', attendees: [me] }), room({ id: 'theirs' })], me, past).map((r) => r.id),
  ['mine'],
);

// A maps handoff carries coordinates, never the address — the whole point is
// not to make a geocoder guess at "level 5".
assert.equal(
  mapsUrl(room(), 'apple'),
  'https://maps.apple.com/?ll=34.0701,-118.4421&q=Lot%20D%20rooftop%2C%20level%205',
);
assert.equal(
  mapsUrl(room(), 'google'),
  'https://www.google.com/maps/search/?api=1&query=34.0701,-118.4421',
);
// Withheld exact coordinates must fall back to the 3dp approximation rather
// than leak the door — or send `undefined,undefined` and drop a pin in the sea.
assert.equal(
  mapsUrl(room({ lat: undefined, lng: undefined }), 'apple'),
  'https://maps.apple.com/?ll=34.07,-118.442&q=Lot%20D%20rooftop%2C%20level%205',
);

/*
 * "Never asked" and "chose Google" have to stay distinguishable — the map
 * chooser appears exactly once because unset is its own state. Anything
 * unrecognised counts as unset, so a value from a later build makes the app ask
 * again rather than reach `mapsUrl` with an app that doesn't exist.
 */
assert.equal(asMapsApp('google'), 'google');
assert.equal(asMapsApp('apple'), 'apple');
assert.equal(asMapsApp(null), undefined, 'nothing stored means never asked');
assert.equal(asMapsApp(''), undefined);
assert.equal(asMapsApp('waze'), undefined, 'an unknown app is unset, not passed through');
assert.equal(asMapsApp('Google'), undefined, 'the stored value is exact, not normalised');

/*
 * Answering a prompt. The order matters more than it looks: the stored order is
 * the order everyone else reads them in, because `Profile` maps `person.prompts`
 * straight out. Appending would move whichever answer you edited last to the
 * bottom of somebody else's screen.
 */
const [first, second] = promptQuestions.map((p) => p.q);
assert.deepEqual(withAnswer(undefined, first, 'Lot D roof'), [{ q: first, a: 'Lot D roof' }]);
assert.deepEqual(
  withAnswer([{ q: second, a: 'anything loud' }], first, 'Lot D roof').map((p) => p.q),
  [first, second],
  'answers sort into the order the questions are asked, never insertion order',
);
// Replaced, not appended twice.
assert.deepEqual(withAnswer([{ q: first, a: 'old' }], first, 'new'), [{ q: first, a: 'new' }]);
// Emptying an answer removes it, so the prompt reads as unanswered rather than
// as a blank line somebody has to guess the meaning of.
assert.deepEqual(withAnswer([{ q: first, a: 'old' }], first, '   '), []);
assert.deepEqual(withAnswer(undefined, first, ''), []);
// Whitespace is trimmed on the way in, so the blur check that compares against
// the saved answer can't loop: save " x ", read back "x", save again.
assert.deepEqual(withAnswer(undefined, first, '  x  '), [{ q: first, a: 'x' }]);
// A question this build no longer asks keeps its answer, at the end.
assert.deepEqual(
  withAnswer([{ q: 'AN OLDER QUESTION', a: 'kept' }], first, 'new').map((p) => p.q),
  [first, 'AN OLDER QUESTION'],
);

// The tag vocabulary is the only validation there is — Postgres caps the count
// and the size but can't check membership — so it has to be free of duplicates.
assert.equal(new Set(interestTags).size, interestTags.length);
assert.ok(interestTags.length > maxInterests, 'a vocabulary you can pick all of is not a choice');

console.log('data.ts ok');
