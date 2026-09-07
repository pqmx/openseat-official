// `.ts` so node can run data.check.ts unbundled, same as time.check.ts.
import { elapsed, when } from './time.ts';

/** Pure app models and derived labels. Viewer identity is passed explicitly. */

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
  interests?: string[];
  /** The design's two profile prompts. */
  prompts?: { q: string; a: string }[];
};

export type Update = {
  id: string;
  text: string;
  at: Date;
  by: Person;
};

export type Access = 'open' | 'approve';

export type Room = {
  id: string;
  title: string;
  /** Venue and attendance label shared by feed rows. */
  place: string;
  /**
   * Roughly where, rounded to 3dp (~110m). Everyone who can see the room gets
   * these, and the map draws its 150m circle from them — coarser than the
   * circle itself, so the circle stops being decoration over an exact address.
   */
  approxLat: number;
  approxLng: number;
  /** Optional WGS84 coordinates; access is decided by the room_pins policy. */
  lat?: number;
  lng?: number;
  host: Person;
  startsAt: Date;
  canceledAt?: Date;
  capacity: number;
  access: Access;
  /** Class years that can see the room at all. Undefined means everyone. */
  years?: string[];
  /** Everyone in, host included — the host holds a membership row too. */
  attendees: Person[];
  /** Waiting on the host, for `access: 'approve'` rooms. */
  requests: Person[];
  updates: Update[];
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
/** Pending requests are visible only to the host and requester. */
export const hasAsked = (room: Room, person: Person) =>
  room.requests.some((p) => p.id === person.id);

/** Narrow to coordinates supplied by the server. */
export const showsExactPin = (room: Room): room is Room & { lat: number; lng: number } =>
  room.lat !== undefined && room.lng !== undefined;

/** Which maps app a handoff link is addressed to. */
export type MapsApp = 'apple' | 'google';

/** Missing or unrecognized preferences prompt the user to choose again. */
export const asMapsApp = (v: string | null | undefined): MapsApp | undefined =>
  v === 'apple' || v === 'google' ? v : undefined;

/** Use server-supplied coordinates. HTTPS links fall back to the web if the maps app is absent. */
export const mapsUrl = (room: Room, app: MapsApp) => {
  const { lat, lng } = showsExactPin(room)
    ? { lat: room.lat, lng: room.lng }
    : { lat: room.approxLat, lng: room.approxLng };
  return app === 'apple'
    ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(room.place)}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

/** Optional feed filters. */
export type Query = { openOnly?: boolean };

/** A limit, so a room passes by default and this can only reject. */
export const matchesQuery = (room: Room, q: Query) => {
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

/** Venue and attendance label shared by feed rows. */
export const metaOf = (room: Room, now: Date) =>
  [
    room.place,
    isLive(room, now)
      ? `${room.attendees.length} here`
      : `${room.attendees.length} of ${room.capacity} seats`,
  ].join(' · ');

/** Room route states. */
export type RoomView = 'member' | 'host' | 'requests' | 'canceled';

/** Select the room screen from lifecycle state and viewer membership. */
export const viewOf = (room: Room, me: Person): RoomView => {
  if (room.canceledAt) return 'canceled';
  if (isHost(room, me)) return room.access === 'approve' ? 'requests' : 'host';
  return 'member';
};

/** Class-year choices shared by onboarding and room creation. */
export const classYears = ["'27", "'28", "'29", 'Grad'];

/** A host may narrow the audience, but never hide their own room from themself. */
export const yearsForHost = (years: string[] | undefined, hostYear: string | undefined) => {
  if (!years || !hostYear || years.includes(hostYear)) return years;
  return [...years, hostYear];
};

/** Suggested profile interests; the server bounds payload size, not this vocabulary. */
export const interestTags = [
  'Late-night food',
  'Study rooms',
  'Basketball',
  'Live music',
  'Film',
  'Climbing',
  'Board games',
  'Beach runs',
  'Coffee',
  'Art',
  'Pickup soccer',
  'Photography',
];

/** As many tags as `profiles_interests_sane` will take. */
export const maxInterests = 6;

/** As long an answer as one prompt gets. */
export const maxAnswer = 140;

/** Profile questions and empty-answer placeholders. */
export const promptQuestions = [
  { q: 'MY IDEAL FRIDAY IS', placeholder: 'Ten words is plenty. Say the real one.' },
  { q: 'TAKE ME TO A ROOM ABOUT', placeholder: "Anything, as long as it's not another club fair." },
];

const rank = (q: string) => {
  const i = promptQuestions.findIndex((p) => p.q === q);
  // A question this build doesn't ask — an older one, a later one — sorts last
  // rather than vanishing. Dropping it would delete an answer on save.
  return i < 0 ? promptQuestions.length : i;
};

/** Replace or remove an answer while preserving question order. */
export const withAnswer = (prompts: Person['prompts'], q: string, a: string) => {
  const text = a.trim();
  const rest = (prompts ?? []).filter((p) => p.q !== q);
  return (text ? [...rest, { q, a: text }] : rest).sort((x, y) => rank(x.q) - rank(y.q));
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

/** Rooms you host or have joined, live first — the Rooms tab. */
export const myRooms = (rooms: Room[], me: Person, now: Date) =>
  rooms
    .filter((r) => isIn(r, me))
    .sort((a, b) => {
      const live = Number(isLive(b, now)) - Number(isLive(a, now));
      return live !== 0 ? live : a.startsAt.getTime() - b.startsAt.getTime();
    });

/** Filter by class year; show live rooms first, then upcoming rooms by start time. */
export const feedFor = (rooms: Room[], year: string, now: Date) =>
  rooms
    .filter((r) => (!r.years || r.years.includes(year)) && !r.canceledAt)
    .sort((a, b) => {
      const live = Number(isLive(b, now)) - Number(isLive(a, now));
      if (live !== 0) return live;
      // Live: most recently started first. Upcoming: soonest first.
      return isLive(a, now)
        ? b.startsAt.getTime() - a.startsAt.getTime()
        : a.startsAt.getTime() - b.startsAt.getTime();
    });
