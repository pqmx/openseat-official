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
  /** "Lot D rooftop, level 5" — shown once you're in. */
  place: string;
  /**
   * Roughly where, rounded to 3dp (~110m). Everyone who can see the room gets
   * these, and the map draws its 150m circle from them — coarser than the
   * circle itself, so the circle stops being decoration over an exact address.
   */
  approxLat: number;
  approxLng: number;
  /**
   * Exactly where, WGS84 — or absent, because the server withheld it. Exact
   * coordinates live in `room_pins` behind their own RLS policy, so a viewer the
   * policy refuses simply receives no row. That is why these are optional:
   * undefined is the server saying no, not data we forgot to load.
   */
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
/**
 * Waiting on the host. Only the host and the requester are sent `requested`
 * rows, so for everyone else this is false because the row isn't there — which
 * is the point: a request nobody approved isn't anybody else's business.
 */
export const hasAsked = (room: Room, person: Person) =>
  room.requests.some((p) => p.id === person.id);

/**
 * Whether the map may drop a pin. This used to re-derive the rule client-side
 * from a `casual` flag and the roster — which only worked because nothing could
 * query around it, and which turned out to be protecting nothing: the flag had
 * no grant that could set it. Now the server decides, and only the server:
 * coordinates arrive or they don't.
 *
 * A type predicate, so the pin branch gets `lat`/`lng` as plain numbers and
 * there is no way to read them without having checked.
 */
export const showsExactPin = (room: Room): room is Room & { lat: number; lng: number } =>
  room.lat !== undefined && room.lng !== undefined;

/** Which maps app a handoff link is addressed to. */
export type MapsApp = 'apple' | 'google';

/**
 * The stored preference, or `undefined` for "never answered".
 *
 * Those are different states and the difference is the whole feature: if a
 * missing value read as `'google'`, the chooser could never appear, because
 * nobody would ever be unset. Anything unrecognised — a value written by a
 * later build, a corrupt read — is treated as unset too, so the app asks again
 * rather than handing `mapsUrl` an app that doesn't exist.
 *
 * Here rather than in `prefs.ts` for the usual reason: `data.ts` is pure, so
 * `data.check.ts` can run this, and AsyncStorage can't be run under node.
 */
export const asMapsApp = (v: string | null | undefined): MapsApp | undefined =>
  v === 'apple' || v === 'google' ? v : undefined;

/**
 * A link that drops a pin on the room in a real maps app.
 *
 * Coordinates, never an address a geocoder has to guess a rooftop level from.
 * `showsExactPin` decides which pair is ours to send, so a non-member hands off
 * the 3dp approximation and never the door — the same rule the map draws its
 * circle by.
 *
 * Both are `https` universal links rather than the `maps://` and
 * `comgooglemaps://` schemes. A scheme has to be declared in
 * `LSApplicationQueriesSchemes` before iOS will even admit it exists, which
 * means an `app.json` edit and a native rebuild; the https forms open the same
 * apps when installed and fall back to the website when not.
 */
export const mapsUrl = (room: Room, app: MapsApp) => {
  const { lat, lng } = showsExactPin(room)
    ? { lat: room.lat, lng: room.lng }
    : { lat: room.approxLat, lng: room.approxLng };
  return app === 'apple'
    ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(room.place)}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};

/**
 * What the feed's filter panel narrows by. An object rather than a bare boolean
 * so a second filter doesn't have to change `matchesQuery` and `narrowed` to
 * add itself back.
 */
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

/**
 * "Lot D rooftop · 14 here" — one rule for every feed row. No distance: nothing
 * measures one, and that would mean asking for location.
 */
export const metaOf = (room: Room, now: Date) =>
  [
    room.place,
    isLive(room, now)
      ? `${room.attendees.length} here`
      : `${room.attendees.length} of ${room.capacity} seats`,
  ].join(' · ');

/** The four ways `/room/[id]` can draw itself. */
export type RoomView = 'member' | 'host' | 'requests' | 'canceled';

/**
 * Which of the four a room opens as. The design draws them and the difference is
 * entirely who you are to the room, so decide it in one place. This is the only
 * thing that decides: the `?view=` override the route used to accept is gone,
 * because joining and ending a room are real writes and the refetch already
 * changes who you are to the room.
 *
 * There was a fifth, `casual` — the pre-join screen for a room that withheld its
 * exact pin. Nothing could ever mark a room casual, so it was never reachable;
 * the column and its policy clause went with it.
 */
export const viewOf = (room: Room, me: Person): RoomView => {
  if (room.canceledAt) return 'canceled';
  if (isHost(room, me)) return room.access === 'approve' ? 'requests' : 'host';
  return 'member';
};

/**
 * The years a room can be limited to, and the ones onboarding offers. Shared
 * so the two lists can't drift — a year Create can restrict to but onboarding
 * can't set would be a room nobody could see.
 */
export const classYears = ["'27", "'28", "'29", 'Grad'];

/** A host may narrow the audience, but never hide their own room from themself. */
export const yearsForHost = (years: string[] | undefined, hostYear: string | undefined) => {
  if (!years || !hostYear || years.includes(hostYear)) return years;
  return [...years, hostYear];
};

/**
 * The tags a profile can carry — and the only ones it can. The picker offers
 * these and has no free-text path, which is the point: a tag you type is a tag
 * nothing else can ever match on, and free text on a profile other students
 * read is a moderation surface with nothing behind it.
 *
 * Postgres caps the count and the size (`profiles_interests_sane`) but not the
 * vocabulary — a CHECK can't hold the subquery that would take. So this list is
 * the vocabulary, the same way `classYears` is.
 */
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

/**
 * The two questions every profile is asked, with the copy shown until they're
 * answered. The labels are the design's; they used to be typed into
 * `ProfileEmpty` as decoration, which is why nothing could fill them in.
 */
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

/**
 * One answer set, replaced or removed, in the order the questions are asked.
 *
 * Sorted rather than appended because the stored order *is* the order everyone
 * else reads: `Profile` maps `person.prompts` straight out. Append, and editing
 * your first answer quietly moves it below your second on their screen.
 */
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

/**
 * Rooms this viewer can see: live ones first, then upcoming by soonest, and
 * inside each group the one that started or starts nearest to now.
 *
 * The `years` filter is belt-and-braces: `rooms_select` in the database already
 * refuses to return a room your year can't see, so a restricted room is absent
 * rather than filtered. One exception it does *not* mirror — the server always
 * hands a host their own room back — which is why a host who restricts a room
 * away from their own year won't see it here. The Rooms tab is that view.
 */
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
