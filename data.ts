import { useEffect, useState } from 'react';
// `.ts` so node can run data.check.ts unbundled, same as time.check.ts.
import { elapsed, when } from './time.ts';

/**
 * The app's data, in the shape a room API would return it. Screens read from
 * here and derive every label — swapping these constants for `fetch` is the
 * only change the UI needs.
 */

export type Tone = 'fill' | 'water' | 'park';

export type Person = {
  id: string;
  initials: string;
  /** Short form for rosters — "Maya", "Ade". */
  short: string;
  /** How they're credited on a room — "Maya J", "Ade T". */
  name: string;
  year: string;
  major: string;
  tone?: Tone;
  dorm?: string;
  interests?: string[];
  /** The design's two profile prompts. */
  prompts?: { q: string; a: string }[];
};

export type Update = {
  id: string;
  text: string;
  at: Date;
  byId: string;
  seenBy: number;
};

export type Access = 'open' | 'approve';

export type Room = {
  id: string;
  title: string;
  /** "Lot D rooftop, level 5" — shown once you're in. */
  place: string;
  street: string;
  walkMinutes: number;
  /** Where the pin drops. Real Westwood coordinates, WGS84. */
  lat: number;
  lng: number;
  hostId: string;
  startsAt: Date;
  canceledAt?: Date;
  capacity: number;
  access: Access;
  /**
   * Casual rooms keep their pin private until you join; the design's rule.
   */
  casual?: boolean;
  /** Class years that can see the room at all. Undefined means everyone. */
  years?: string[];
  /** Person ids, host first. */
  attendees: string[];
  /** Waiting on the host, for `access: 'approve'` rooms. */
  requests: string[];
  updates: Update[];
  blurb?: string;
};

export const people: Person[] = [
  {
    id: 'mj',
    initials: 'MJ',
    short: 'Maya',
    name: 'Maya J',
    year: "'27",
    major: 'Architecture',
    dorm: 'Rieber Hall',
    interests: ['film photo', 'rooftops', 'house shows', 'thrifting', 'late library'],
    prompts: [
      { q: 'MY IDEAL FRIDAY IS', a: "Someone's speaker on a roof and zero plans after" },
      { q: 'TAKE ME TO A ROOM ABOUT', a: 'Anything that ends up at Diddy Riese' },
    ],
  },
  {
    id: 'at',
    initials: 'AT',
    short: 'Ade',
    name: 'Ade T',
    year: "'28",
    major: 'Econ',
    dorm: 'Hedrick Hall',
    interests: ['pickup soccer', 'cheap dinners', 'ceramics'],
    prompts: [{ q: 'MY IDEAL FRIDAY IS', a: 'Broxton, then wherever the group drifts' }],
  },
  { id: 'rk', initials: 'RK', short: 'Ro', name: 'Ro K', year: "'27", major: 'Sociology' },
  { id: 'sp', initials: 'SP', short: 'Sam', name: 'Sam P', year: "'29", major: 'Undeclared' },
  { id: 'dl', initials: 'DL', short: 'Dee', name: 'Dee L', year: "'28", major: 'Physics' },
  {
    id: 'nb',
    initials: 'NB',
    short: 'Nia',
    name: 'Nia B',
    year: "'28",
    major: 'Design | Media Arts',
  },
  { id: 'jc', initials: 'JC', short: 'Jos', name: 'Jos C', year: "'29", major: 'History', tone: 'water' },
  {
    id: 'tv',
    initials: 'TV',
    short: 'Theo',
    name: 'Theo V',
    year: "'27",
    major: 'Materials Science',
    tone: 'park',
  },
  { id: 'em', initials: 'EM', short: 'Emi', name: 'Emi M', year: "'29", major: 'Undeclared', tone: 'water' },
];

export const you = people[0];

/** Fixtures are pinned to launch so the "live for 22 min" labels stay honest. */
const launch = Date.now();
const minutesAgo = (n: number) => new Date(launch - n * 60_000);
const minutesOn = (n: number) => new Date(launch + n * 60_000);
/**
 * The next time today reads `hour:minute` — tomorrow if it's already gone.
 * Fixtures pinned to a wall-clock time would drift into the past and start
 * showing a study session as "live" at midnight.
 */
const nextAt = (hour: number, minute = 0) => {
  const d = new Date(launch);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= launch) d.setDate(d.getDate() + 1);
  return d;
};

/** The next `weekday` (0 = Sunday) at `hour`, always ahead of now. */
const nextWeekdayAt = (weekday: number, hour: number) => {
  const d = nextAt(hour);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return d;
};

const juniorsUp = ["'27", "'28"];

export const rooms: Room[] = [
  {
    id: 'sunset',
    title: 'Sunset set on Lot D roof',
    place: 'Lot D rooftop, level 5',
    street: 'Charles E Young Dr',
    walkMinutes: 4,
    lat: 34.07,
    lng: -118.442,
    hostId: 'mj',
    startsAt: minutesAgo(22),
    capacity: 18,
    access: 'open',
    years: juniorsUp,
    attendees: ['mj', 'at', 'rk', 'sp', 'dl', 'nb', 'jc', 'tv', 'em', 'x1', 'x2', 'x3', 'x4', 'x5'],
    requests: [],
    updates: [
      {
        id: 'u2',
        text: 'On the roof by the stairwell door — text me if the badge reader is being weird',
        at: minutesAgo(2),
        byId: 'mj',
        seenBy: 12,
      },
      {
        id: 'u1',
        text: "Room opened — bring a layer, it's windy up here",
        at: minutesAgo(22),
        byId: 'mj',
        seenBy: 14,
      },
    ],
  },
  {
    id: 'diddy',
    title: 'Diddy Riese run, then the hill',
    place: 'Outside Diddy Riese',
    street: 'Broxton Ave',
    walkMinutes: 6,
    lat: 34.063,
    lng: -118.4462,
    hostId: 'sp',
    startsAt: minutesAgo(8),
    capacity: 12,
    access: 'open',
    attendees: ['sp', 'em', 'jc', 'x1', 'x2', 'x3'],
    requests: [],
    updates: [],
  },
  {
    id: 'hedrick',
    title: 'Hedrick lounge, bad movie',
    place: 'Hedrick Hall, floor 1',
    street: 'De Neve Dr',
    walkMinutes: 3,
    lat: 34.073,
    lng: -118.4522,
    hostId: 'dl',
    startsAt: minutesAgo(41),
    capacity: 15,
    access: 'open',
    attendees: ['dl', 'rk', 'nb', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6'],
    requests: [],
    updates: [],
  },
  {
    id: 'studio',
    title: 'Studio night, 8 people max',
    place: 'Perloff Hall, studio 1220',
    street: 'Charles E Young Dr',
    walkMinutes: 7,
    lat: 34.0745,
    lng: -118.4402,
    hostId: 'mj',
    startsAt: minutesAgo(12),
    capacity: 8,
    access: 'approve',
    attendees: ['mj', 'at', 'rk', 'sp', 'dl'],
    requests: ['nb', 'tv', 'em'],
    updates: [],
  },
  {
    id: 'dinner',
    title: "Grab dinner, whoever's around",
    place: 'A place on Broxton',
    street: 'Westwood',
    walkMinutes: 10,
    lat: 34.0627,
    lng: -118.4458,
    hostId: 'at',
    startsAt: minutesOn(75),
    capacity: 4,
    access: 'open',
    casual: true,
    attendees: ['at', 'jc'],
    requests: [],
    updates: [],
    blurb:
      "Somewhere cheap on Broxton, then whoever's still up can walk over to the ceramics thing.",
  },
  {
    id: 'econ',
    title: 'Econ 121 cram, no fear',
    place: 'Powell Library, floor 2',
    street: 'Charles E Young Dr',
    walkMinutes: 8,
    lat: 34.0717,
    lng: -118.4423,
    hostId: 'rk',
    startsAt: nextAt(21, 30),
    capacity: 20,
    access: 'open',
    years: juniorsUp,
    attendees: ['rk', 'at', 'dl', 'x1', 'x2', 'x3'],
    requests: [],
    updates: [],
  },
  {
    id: 'thrift',
    title: 'Thrift swap on Bruin Walk',
    place: 'Bruin Walk',
    street: 'Bruin Walk',
    walkMinutes: 5,
    lat: 34.0705,
    lng: -118.4468,
    hostId: 'nb',
    startsAt: nextWeekdayAt(6, 14),
    capacity: 24,
    access: 'open',
    attendees: ['nb', 'jc', 'em', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6'],
    requests: [],
    updates: [],
  },
  {
    id: 'film',
    title: 'Film swap, Sunset Rec',
    place: 'Sunset Rec',
    street: 'De Neve Dr',
    walkMinutes: 12,
    lat: 34.0722,
    lng: -118.4505,
    hostId: 'mj',
    startsAt: nextWeekdayAt(6, 16),
    capacity: 12,
    access: 'open',
    years: juniorsUp,
    attendees: ['mj', 'rk', 'tv'],
    requests: [],
    updates: [],
  },
];

/**
 * Undefined when there's no such room, so callers have to say what that looks
 * like. This used to fall back to `rooms[0]`, which meant a stale link quietly
 * rendered somebody else's room as though you'd asked for it.
 */
export const roomById = (id: string) => rooms.find((r) => r.id === id);
export const personById = (id: string) => people.find((p) => p.id === id);

/** Rooms this person hosts, live first — the tail of their profile. */
export const hostedBy = (personId: string, now: Date) =>
  rooms
    .filter((r) => r.hostId === personId && !r.canceledAt)
    .sort((a, b) => Number(isLive(b, now)) - Number(isLive(a, now)));

/**
 * Stands in for a host who isn't in `people`. Five screens read `hostOf(room)`
 * unconditionally, so it stays total — but the old fallback was `you`, which
 * told you that you hosted a room you'd never opened.
 */
const unknownPerson: Person = {
  id: '?',
  initials: '?',
  short: 'Someone',
  name: 'Someone',
  year: '',
  major: '',
};

export const hostOf = (room: Room) => personById(room.hostId) ?? unknownPerson;

/** Named people only — the roster is padded with anonymous ids for the count. */
export const rosterOf = (room: Room) =>
  room.attendees.map(personById).filter((p): p is Person => !!p);

export const seatsLeft = (room: Room) => Math.max(0, room.capacity - room.attendees.length);
export const isLive = (room: Room, now: Date) => !room.canceledAt && room.startsAt <= now;
export const isHost = (room: Room, person = you) => room.hostId === person.id;

/**
 * Whether the map may drop a pin on the room's actual address. Casual rooms
 * keep that private until you're in — the same rule `viewOf` uses to send
 * non-members to the pre-join screen, so the two can't disagree.
 */
export const showsExactPin = (room: Room, person = you) =>
  !room.casual || room.attendees.includes(person.id);

/** What the feed's search field and filter panel narrow by. */
export type Query = { text?: string; maxWalk?: number; openOnly?: boolean };

/** Free text hits the three things a room is findable by; the rest are limits. */
export const matchesQuery = (room: Room, q: Query) => {
  const text = q.text?.trim().toLowerCase();
  if (text) {
    const haystack = `${room.title} ${room.place} ${room.street}`.toLowerCase();
    if (!haystack.includes(text)) return false;
  }
  if (q.maxWalk !== undefined && room.walkMinutes > q.maxWalk) return false;
  if (q.openOnly && seatsLeft(room) === 0) return false;
  return true;
};

export type Status = { label: string; tone: 'live' | 'soon' | 'off' };

/** The eyebrow above every room, everywhere it appears. */
export const statusOf = (room: Room, now: Date): Status =>
  room.canceledAt
    ? { label: 'CANCELED', tone: 'off' }
    : isLive(room, now)
      ? { label: `LIVE · ${elapsed(room.startsAt, now)}`, tone: 'live' }
      : { label: when(room.startsAt, now), tone: 'soon' };

/** "Lot D rooftop · 4 min · 14 here" — one rule for every feed row. */
export const metaOf = (room: Room, now: Date) =>
  [
    room.place,
    `${room.walkMinutes} min`,
    isLive(room, now)
      ? `${room.attendees.length} here`
      : `${room.attendees.length} of ${room.capacity} seats`,
  ].join(' · ');

/** The five ways `/room/[id]` can draw itself. */
export type RoomView = 'member' | 'host' | 'requests' | 'casual' | 'canceled';

/**
 * Which of the five a room opens as. The design draws five screens and the
 * difference is entirely who you are to the room, so decide it in one place.
 * `?view=` overrides it for transitions the fixtures can't express (ending a
 * room, joining one) — see app/room/[id].tsx.
 */
export const viewOf = (room: Room): RoomView => {
  if (room.canceledAt) return 'canceled';
  if (isHost(room)) return room.access === 'approve' ? 'requests' : 'host';
  if (room.attendees.includes(you.id)) return 'member';
  // Casual rooms hide their pin until you're in, so non-members get that view.
  return room.casual ? 'casual' : 'member';
};

/** What Create knows by the time you press "Open the room". */
export type Draft = {
  title: string;
  place: string;
  startsAt: Date;
  capacity: number;
  access: Access;
  years?: string[];
};

/**
 * Appends a room you host and returns its id, so Create can navigate to the
 * room it just made instead of to a fixture. In memory only — this dies with
 * the process, and is the seam a POST replaces.
 * ponytail: no persistence, swap for the API call when there is one.
 */
export const createRoom = (draft: Draft) => {
  const id = `new-${rooms.length}-${draft.startsAt.getTime()}`;
  rooms.push({
    id,
    title: draft.title,
    place: draft.place,
    street: 'Charles E Young Dr',
    walkMinutes: 4,
    // Campus centre until Create can actually place a pin.
    lat: 34.0701,
    lng: -118.4445,
    hostId: you.id,
    startsAt: draft.startsAt,
    capacity: draft.capacity,
    access: draft.access,
    years: draft.years,
    attendees: [you.id],
    requests: [],
    updates: [],
  });
  return id;
};

/** Rooms you host or have joined, live first — the Rooms tab. */
export const myRooms = (now: Date) =>
  rooms
    .filter((r) => r.attendees.includes(you.id))
    .sort((a, b) => {
      const live = Number(isLive(b, now)) - Number(isLive(a, now));
      return live !== 0 ? live : a.startsAt.getTime() - b.startsAt.getTime();
    });

/**
 * Rooms this viewer can see: live ones first and nearest first inside that —
 * "live nearby" is a walking decision — then upcoming by soonest. A
 * year-restricted room is absent for other years, never greyed out.
 */
export const feedFor = (year: string, now: Date) =>
  rooms
    .filter((r) => (!r.years || r.years.includes(year)) && !r.canceledAt)
    .sort((a, b) => {
      const live = Number(isLive(b, now)) - Number(isLive(a, now));
      if (live !== 0) return live;
      if (isLive(a, now)) return a.walkMinutes - b.walkMinutes;
      return a.startsAt.getTime() - b.startsAt.getTime();
    });

/** Re-renders on a cadence so "LIVE · 22 MIN" doesn't go stale on screen. */
export const useNow = (everyMs = 30_000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
};
