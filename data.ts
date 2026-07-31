// `.ts` so node can run data.check.ts unbundled, same as time.check.ts.
import { elapsed, when } from './time.ts';

/**
 * The app's model and every label derived from it. Pure — no React, no network.
 * `api.ts` fetches Supabase rows and maps them into these shapes; screens read
 * only from here, so the derivations are identical wherever a room appears.
 *
 * The viewer is always an argument. It used to be a module-level `you`, which
 * cannot survive a real session: two accounts on one device, or a signed-out
 * first frame, would both read whoever was hardcoded.
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
  by: Person;
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
  /**
   * Roughly where, rounded to 3dp (~110m). Everyone who can see the room gets
   * these, and the map draws its 150m circle from them — coarser than the
   * circle itself, so the circle stops being decoration over an exact address.
   */
  approxLat: number;
  approxLng: number;
  /**
   * Exactly where, WGS84 — or absent, because the server withheld it. A casual
   * room's exact coordinates live in `room_pins` behind their own RLS policy,
   * so a non-member simply receives no row. That is why these are optional:
   * undefined is the server saying no, not data we forgot to load.
   */
  lat?: number;
  lng?: number;
  host: Person;
  startsAt: Date;
  canceledAt?: Date;
  capacity: number;
  access: Access;
  /** Casual rooms keep their pin private until you join; the design's rule. */
  casual?: boolean;
  /** Class years that can see the room at all. Undefined means everyone. */
  years?: string[];
  /** Everyone in, host included — the host holds a membership row too. */
  attendees: Person[];
  /** Waiting on the host, for `access: 'approve'` rooms. */
  requests: Person[];
  updates: Update[];
  blurb?: string;
};

/** Undefined when there's no such room, so callers have to say what that looks like. */
export const roomById = (rooms: Room[], id: string) => rooms.find((r) => r.id === id);

/** Rooms this person hosts, live first — the tail of their profile. */
export const hostedBy = (rooms: Room[], personId: string, now: Date) =>
  rooms
    .filter((r) => r.host.id === personId && !r.canceledAt)
    .sort((a, b) => Number(isLive(b, now)) - Number(isLive(a, now)));

/** The room carries its host, so this is now a field read kept as a name. */
export const hostOf = (room: Room) => room.host;

/** Everyone shown in a roster. */
export const rosterOf = (room: Room) => room.attendees;

export const seatsLeft = (room: Room) => Math.max(0, room.capacity - room.attendees.length);
export const isLive = (room: Room, now: Date) => !room.canceledAt && room.startsAt <= now;
export const isHost = (room: Room, person: Person) => room.host.id === person.id;
export const isIn = (room: Room, person: Person) => room.attendees.some((p) => p.id === person.id);

/**
 * Whether the map may drop a pin. This used to re-derive the rule client-side
 * from `casual` and the roster — which only worked because nothing could query
 * around it. Now the server decides: coordinates arrive or they don't.
 *
 * A type predicate, so the pin branch gets `lat`/`lng` as plain numbers and
 * there is no way to read them without having checked.
 */
export const showsExactPin = (room: Room): room is Room & { lat: number; lng: number } =>
  room.lat !== undefined && room.lng !== undefined;

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
 * `?view=` overrides it for transitions the fixtures can't express — see
 * app/room/[id].tsx.
 */
export const viewOf = (room: Room, me: Person): RoomView => {
  if (room.canceledAt) return 'canceled';
  if (isHost(room, me)) return room.access === 'approve' ? 'requests' : 'host';
  if (isIn(room, me)) return 'member';
  // Casual rooms hide their pin until you're in, so non-members get that view.
  return room.casual ? 'casual' : 'member';
};

/**
 * The years a room can be limited to, and the ones onboarding offers. Shared
 * so the two lists can't drift — a year Create can restrict to but onboarding
 * can't set would be a room nobody could see.
 */
export const classYears = ["'27", "'28", "'29", 'Grad'];

/** What Create knows by the time you press "Open the room". */
export type Draft = {
  title: string;
  place: string;
  startsAt: Date;
  capacity: number;
  access: Access;
  years?: string[];
};

/** Rooms you host or have joined, live first — the Rooms tab. */
export const myRooms = (rooms: Room[], me: Person, now: Date) =>
  rooms
    .filter((r) => isIn(r, me))
    .sort((a, b) => {
      const live = Number(isLive(b, now)) - Number(isLive(a, now));
      return live !== 0 ? live : a.startsAt.getTime() - b.startsAt.getTime();
    });

/**
 * Rooms this viewer can see: live ones first and nearest first inside that —
 * "live nearby" is a walking decision — then upcoming by soonest.
 *
 * The `years` filter is now belt-and-braces: `rooms_select` in the database
 * already refuses to return a room your year can't see, so a restricted room is
 * absent rather than filtered. Keeping it here costs nothing and means the sort
 * still behaves if this ever runs against unfiltered rows.
 */
export const feedFor = (rooms: Room[], year: string, now: Date) =>
  rooms
    .filter((r) => (!r.years || r.years.includes(year)) && !r.canceledAt)
    .sort((a, b) => {
      const live = Number(isLive(b, now)) - Number(isLive(a, now));
      if (live !== 0) return live;
      if (isLive(a, now)) return a.walkMinutes - b.walkMinutes;
      return a.startsAt.getTime() - b.startsAt.getTime();
    });
