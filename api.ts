import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import type { Access, Draft, Person, Room, Tone, Update } from './data';
import { supabase } from './supabase';

/**
 * The seam CLAUDE.md always pointed at. Everything here turns Supabase rows
 * into the shapes `data.ts` derives labels from — snake_case to camelCase,
 * timestamps to `Date`, and the two membership states back into the
 * `attendees` / `requests` split the screens already read.
 *
 * No filtering happens here that the database isn't already doing. Year
 * visibility and casual-room coordinates are RLS policies; if a row arrives,
 * you were allowed to see it.
 */

const personCols = 'id, name, short, initials, year, major, tone, interests, prompts';

// PostgREST returns an embedded one-to-one as an object, but a to-many as an
// array, and the shape depends on how it reads the constraint. Take either.
const one = <T,>(v: T | T[] | null | undefined): T | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

const toPerson = (r: any): Person => ({
  id: r.id,
  initials: r.initials,
  short: r.short,
  name: r.name,
  year: r.year ?? '',
  major: r.major ?? '',
  tone: r.tone ?? undefined,
  interests: r.interests?.length ? r.interests : undefined,
  prompts: r.prompts?.length ? r.prompts : undefined,
});

const toUpdate = (r: any): Update => ({
  id: r.id,
  text: r.body,
  at: new Date(r.created_at),
  by: toPerson(r.author),
});

const roomCols = `
  id, title, place, starts_at, canceled_at, capacity,
  access, casual, years, approx_lat, approx_lng,
  host:profiles!rooms_host_id_fkey(${personCols}),
  pin:room_pins(lat, lng),
  members:room_members(state, profile:profiles!room_members_profile_id_fkey(${personCols})),
  updates:room_updates(id, body, created_at,
    author:profiles!room_updates_author_id_fkey(${personCols}))
`;

const toRoom = (r: any): Room => {
  const members: any[] = r.members ?? [];
  const pin = one<any>(r.pin);
  const named = (state: string) => {
    const out: Person[] = [];
    for (const m of members) if (m.state === state && m.profile) out.push(toPerson(m.profile));
    return out;
  };
  return {
    id: r.id,
    title: r.title,
    place: r.place,
    approxLat: r.approx_lat,
    approxLng: r.approx_lng,
    // Absent for a casual room you haven't joined — the server withheld it.
    lat: pin?.lat ?? undefined,
    lng: pin?.lng ?? undefined,
    host: toPerson(r.host),
    startsAt: new Date(r.starts_at),
    canceledAt: r.canceled_at ? new Date(r.canceled_at) : undefined,
    capacity: r.capacity,
    access: r.access,
    casual: r.casual ?? false,
    years: r.years ?? undefined,
    attendees: named('member'),
    requests: named('requested'),
    // Newest first: the room screen and every preview show `updates[0]`.
    updates: (r.updates ?? []).map(toUpdate).sort((a: Update, b: Update) => +b.at - +a.at),
  };
};

export const fetchRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase.from('rooms').select(roomCols);
  if (error) throw error;
  return (data ?? []).map(toRoom);
};

export const fetchPerson = async (id: string): Promise<Person | undefined> => {
  const { data, error } = await supabase.from('profiles').select(personCols).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toPerson(data) : undefined;
};

/**
 * Every field of your own profile you may write — which is every field
 * `authenticated` holds an UPDATE grant on, and no more. `name`, `short` and
 * `initials` are absent on purpose: Google set them through
 * `handle_new_user()`, and the grant, not this signature, is what keeps them.
 * Sending one here gets a 403 rather than a rename.
 *
 * `year` is not cosmetic: `rooms_select` keys the whole feed off it, so a
 * profile without one sees almost nothing.
 */
export const saveProfile = async (
  id: string,
  patch: { year?: string; major?: string; interests?: string[]; prompts?: Person['prompts'] },
) =>
  changed(
    await supabase
      .from('profiles')
      .update({
        // Only what was passed: a patch of prompts must not blank the major.
        ...(patch.year !== undefined ? { year: patch.year } : {}),
        ...(patch.major !== undefined ? { major: patch.major.trim() || null } : {}),
        ...(patch.interests !== undefined ? { interests: patch.interests } : {}),
        ...(patch.prompts !== undefined ? { prompts: patch.prompts } : {}),
      })
      .eq('id', id)
      .select('id'),
    'Could not save your profile.',
  );

/**
 * The last feed anyone fetched. Three routes call `useRooms` and none of them
 * share state, so without this, tapping a room from the feed blanks the screen
 * and refetches every room's roster to draw a room the feed already had.
 *
 * It is a snapshot, not a cache with rules: whoever mounts next paints from it
 * and revalidates behind. It is cleared on any change of signed-in user, because
 * RLS decided these rows for *that* session and none of them are the next one's
 * to see.
 *
 * ponytail: one module-level array. A real query cache (TanStack Query) is the
 * upgrade if per-room keys or selective invalidation ever matter.
 */
let cached: Room[] = [];
let cachedFor: string | undefined;

supabase.auth.onAuthStateChange((_e, s) => {
  if (s?.user.id === cachedFor) return;
  cached = [];
  cachedFor = s?.user.id;
});

/**
 * Every room the signed-in student may see. One request: RLS decides the rows,
 * so there is no "visible to me" filter to get wrong on the client.
 */
export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>(cached);
  const [error, setError] = useState<Error>();
  // Two questions, and one boolean answered both wrong.
  //
  // `loading` is "nothing to paint yet". The feeds render null on it, so a warm
  // cache must not raise it, or every navigation and every write blanks a
  // screen that already had the answer.
  //
  // `settled` is "this mount has heard back". Only that tells a dead link from
  // a room not fetched yet: the room you just created is missing from the cache
  // for one paint, and `roomById` can't tell that from a bad id on its own.
  const [loading, setLoading] = useState(!cached.length);
  const [settled, setSettled] = useState(false);

  const reload = useCallback(() => {
    return fetchRooms()
      .then((r) => {
        cached = r;
        setRooms(r);
        setError(undefined);
      })
      .catch(setError)
      .finally(() => {
        setLoading(false);
        setSettled(true);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /*
   * Re-read on foreground. This is the reconciliation the socket can't do for
   * itself: a mobile WebSocket drops while backgrounded and reconnects without
   * replaying what it missed, so coming back to the app is exactly the moment
   * the roster in memory is most likely to be wrong. Same reasoning as the auth
   * refresh in `supabase.ts`, which is tied to foreground for the same reason.
   *
   * It lives here rather than beside the channel so all three routes that call
   * `useRooms` get it, including the two with no realtime subscription at all.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [reload]);

  return { rooms, loading, settled, error, reload };
};

/**
 * Re-renders on a cadence so "LIVE · 22 MIN" doesn't go stale on screen.
 *
 * A clock, not a fetch: this moves `now` forward so the derived labels recompute
 * from rooms already in memory. A room somebody else opened still won't appear
 * until `useRooms` reloads, which only happens on mount and after a write.
 */
export const useNow = (everyMs = 10_000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
};

/** One row under the location field. No coordinates — Google's predictions
 *  don't carry any, and asking for them per keystroke is the expensive way. */
export type PlaceSuggestion = { id: string; title: string; sub: string };

/** A place you can actually open a room at — a name and the coordinates behind it. */
export type PlaceHit = { title: string; sub: string; lat: number; lng: number };

/**
 * Place search for Create's location field, via the `places-search` edge function.
 *
 * **The Google key is deliberately not here, and must not move here.** Anything
 * the client can read, so can anyone holding the binary — and unlike the
 * Supabase publishable key, which is safe because RLS is the protection, a
 * Places key has no protection behind it. The Places *web service* accepts no
 * application restriction that holds: iOS/Android key restrictions bind the
 * native SDKs, not the REST endpoint, and App Check doesn't cover it either.
 * Google's own guidance for a mobile app calling a Maps web service is a proxy
 * server, so the function is that proxy. It holds the key and checks your
 * session before spending it.
 *
 * Searching is two calls because the billing is: every `searchPlaces` in one
 * `session` is free, and `resolvePlace` is the single charge that ends it. Pass
 * the same token to both or Google bills each keystroke separately, and start a
 * fresh one per search — see `newSession` in `screens/Create.tsx`.
 */
export const searchPlaces = async (
  query: string,
  session: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> => {
  const { data, error } = await supabase.functions.invoke<PlaceSuggestion[]>('places-search', {
    body: { q: query, session },
    signal,
  });
  if (error) throw error;
  return data ?? [];
};

/** Coordinates for a suggestion, asked for once, when somebody picks it. */
export const resolvePlace = async (
  id: string,
  session: string,
): Promise<{ lat: number; lng: number }> => {
  const { data, error } = await supabase.functions.invoke<{ lat: number; lng: number }>(
    'places-search',
    { body: { placeId: id, session } },
  );
  if (error) throw error;
  if (!data) throw new Error('Could not pin that place.');
  return data;
};

/**
 * Creates the room, its pin and the host's own membership in one transaction.
 * Three inserts from the client could half-succeed and leave a room nobody is
 * in, so it is a single `security invoker` function instead — the insert policies
 * still authorise every row it writes.
 */
export const createRoom = async (draft: Draft, lat: number, lng: number): Promise<string> => {
  const { data, error } = await supabase.rpc('create_room', {
    p_title: draft.title,
    p_place: draft.place,
    p_starts_at: draft.startsAt.toISOString(),
    p_capacity: draft.capacity,
    p_access: draft.access,
    p_years: draft.years ?? null,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
  return data as string;
};

/**
 * The writes. Every rule they look like they enforce — who may join, who may
 * approve, who may post — is a policy in the database; these only choose which
 * statement to send. A button that sends the wrong one gets refused, not obeyed.
 *
 * A refusal is not always an error, which is the trap here. An insert that fails
 * `with check` raises, but an update or delete whose `using` clause matches no
 * row simply succeeds having done nothing. So every one of these asks for the
 * affected rows back and treats an empty result as the refusal it is — otherwise
 * "Leave room" would cheerfully report success while leaving you in the room.
 */
const changed = <T>(
  { data, error }: { data: T[] | null; error: { message: string } | null },
  refusal: string,
) => {
  if (error) throw error;
  if (!data?.length) throw new Error(refusal);
  return data;
};

/** Join an open room, or ask to join one the host approves. */
export const joinRoom = async (roomId: string, meId: string, access: Access) =>
  changed(
    await supabase
      .from('room_members')
      .insert({ room_id: roomId, profile_id: meId, state: access === 'approve' ? 'requested' : 'member' })
      .select('state'),
    'That room stopped taking people.',
  );

export const leaveRoom = async (roomId: string, meId: string) =>
  changed(
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('profile_id', meId).select('room_id'),
    "You can't leave a room you're hosting.",
  );

export const approveRequest = async (roomId: string, personId: string) =>
  changed(
    await supabase
      .from('room_members')
      .update({ state: 'member' })
      .eq('room_id', roomId)
      .eq('profile_id', personId)
      .select('profile_id'),
    'That request could not be approved — the room may be full.',
  );

export const declineRequest = async (roomId: string, personId: string) =>
  changed(
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('profile_id', personId).select('profile_id'),
    'That request could not be declined.',
  );

export const postUpdate = async (roomId: string, meId: string, body: string) =>
  changed(
    await supabase.from('room_updates').insert({ room_id: roomId, author_id: meId, body }).select('id'),
    'Only the host can post updates here.',
  );

export const endRoom = async (roomId: string) =>
  changed(
    await supabase.from('rooms').update({ canceled_at: new Date().toISOString() }).eq('id', roomId).select('id'),
    'Only the host can end this room.',
  );

/** Both ids are optional on the table, but a report naming neither is refused. */
export const submitReport = async (report: {
  reporterId: string;
  personId?: string;
  roomId?: string;
  reason: string;
  detail?: string;
  blocked: boolean;
}) =>
  changed(
    await supabase
      .from('reports')
      .insert({
        reporter_id: report.reporterId,
        profile_id: report.personId ?? null,
        room_id: report.roomId ?? null,
        reason: report.reason,
        detail: report.detail?.trim() || null,
        blocked: report.blocked,
      })
      .select('id'),
    'That report could not be filed.',
  );

/** Somebody you blocked, and the report row that is the block. */
export type Block = {
  /** The `reports` row. Lifting the block is an update to it, not a delete —
   *  the report itself is triage's, and stays. */
  reportId: string;
  person: { id: string; name: string; initials: string; tone?: Tone };
  at: Date;
};

/**
 * Everyone you've blocked, newest first.
 *
 * An RPC rather than a select, because blocking someone is exactly what makes
 * them unreadable: `profiles_select` only reaches a stranger through
 * `private.shares_room`, which `private.can_see_room` refuses for a blocked
 * pair. Embedding `reports -> profiles` returns a null profile on every row, so
 * `public.my_blocks()` is a definer function that hands back the three columns a
 * row needs to draw — for reports you filed, and no one else's.
 */
export const fetchBlocks = async (): Promise<Block[]> => {
  const { data, error } = await supabase.rpc('my_blocks');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    reportId: r.report_id,
    person: { id: r.profile_id, name: r.name, initials: r.initials, tone: r.tone ?? undefined },
    at: new Date(r.at),
  }));
};

/** Lift a block. `blocked` is the one column of a report its author may write. */
export const unblock = async (reportId: string) =>
  changed(
    await supabase.from('reports').update({ blocked: false }).eq('id', reportId).select('id'),
    'That block could not be lifted.',
  );

/**
 * Ends the account, which Apple requires and nothing here could do.
 *
 * It is one RPC because the last statement is a delete from `auth.users`, which
 * no policy can express and no student may send. `public.delete_me()` is
 * `security definer` and does the rest in the same transaction: the rooms you
 * host are called off rather than deleted, so the people who joined find out;
 * your profile is scrubbed to a tombstone so those rooms still render; and the
 * reports you filed stay, because they are the block, and deleting your account
 * must not quietly make you visible again to someone you blocked.
 *
 * The caller signs out afterwards — see `deleteAccount` in `session.tsx`. There
 * is no session left to keep, and `onAuthStateChange` is what clears the feed.
 */
export const deleteAccount = async () => {
  const { error } = await supabase.rpc('delete_me');
  if (error) throw error;
};

/**
 * One in-flight write at a time, and a sentence when it fails. Without this each
 * of the seven buttons would need its own try/catch, and a double tap would send
 * the statement twice. Handlers can't reach the router's ErrorBoundary — nothing
 * is rendering when they run — so a failed write says so where you pressed it.
 */
export const useWrite = () => {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (busy) return false;
      setBusy(true);
      try {
        await fn();
        return true;
      } catch (e) {
        Alert.alert("That didn't work", e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  return { busy, run };
};
