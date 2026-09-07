import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import type { Access, Draft, Person, Room, Tone, Update } from './data';
import { ROOM_REFRESH_MS } from './refresh';
import { createRoomCache } from './room-cache';
import { supabase } from './supabase';

/** Convert Supabase rows to app data. Database policies enforce access. */

const personCols = 'id, name, short, initials, year, major, tone, interests, prompts';

/**
 * The same person, as much of them as a roster row draws — and no more.
 *
 * `fetchRooms` embeds a profile for the host, every member and every update's
 * author, so whatever is listed here is handed over for most of the user base
 * in a single request. `interests` and `prompts` are free text somebody wrote
 * about themselves and nothing outside `screens/Profile` renders them, so they
 * are not the feed's to carry. The profile route fetches the full row through
 * `fetchPerson` when somebody actually taps through.
 *
 * `year` and `major` stay: `Room` and the feed card both print them.
 */
const rosterCols = 'id, name, short, initials, year, major, tone';

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
  prompts: Array.isArray(r.prompts)
    ? r.prompts.filter((p: any) => p && typeof p.q === 'string' && typeof p.a === 'string')
    : undefined,
});

const toUpdate = (r: any): Update => ({
  id: r.id,
  text: r.body,
  at: new Date(r.created_at),
  by: toPerson(r.author),
});

const roomCols = `
  id, title, place, starts_at, canceled_at, capacity,
  access, years, approx_lat, approx_lng,
  host:profiles!rooms_host_id_fkey(${rosterCols}),
  pin:room_pins(lat, lng),
  members:room_members(state, profile:profiles!room_members_profile_id_fkey(${rosterCols})),
  updates:room_updates(id, body, created_at,
    author:profiles!room_updates_author_id_fkey(${rosterCols}))
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
    // Absent when the server withheld the pin, which `showsExactPin` is the
    // only permitted way to ask about.
    lat: pin?.lat ?? undefined,
    lng: pin?.lng ?? undefined,
    host: toPerson(r.host),
    startsAt: new Date(r.starts_at),
    canceledAt: r.canceled_at ? new Date(r.canceled_at) : undefined,
    capacity: r.capacity,
    access: r.access,
    years: r.years ?? undefined,
    attendees: named('member'),
    requests: named('requested'),
    // Newest first: the room screen and every preview show `updates[0]`.
    updates: (r.updates ?? []).map(toUpdate).sort((a: Update, b: Update) => +b.at - +a.at),
  };
};

/**
 * Every room the signed-in student may see, up to a ceiling.
 *
 * The ceiling is the point. This is one request that fans out to a profile per
 * host, per member and per update author, and every one of those rows re-runs
 * `profiles_select` -> `shares_room` -> `can_see_room`, which is three
 * subqueries each. Unbounded, the cost grows with rooms x members and a signed-in
 * caller can hold it in a loop; `room_updates` in particular had no bound at all,
 * so a host posting in a loop grew every feed response for everyone.
 *
 * ponytail: two fixed ceilings, not pagination. The feed is "what's on today" and
 * has never had a second page; if it ever needs one, this becomes a cursor on
 * `starts_at` and the ceilings stay as the page size.
 */
export const fetchRooms = async (): Promise<Room[]> => {
  const { data, error } = await supabase
    .from('rooms')
    .select(roomCols)
    .order('starts_at', { ascending: true })
    .limit(200)
    // Newest first so the ceiling keeps the updates that matter — every screen
    // reads `updates[0]`, and the room screen shows the recent few.
    .order('created_at', { referencedTable: 'updates', ascending: false })
    .limit(20, { referencedTable: 'updates' });
  if (error) throw error;
  return (data ?? []).map(toRoom);
};

export const fetchPerson = async (id: string): Promise<Person | undefined> => {
  const { data, error } = await supabase.from('profiles').select(personCols).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toPerson(data) : undefined;
};

/** Patch editable profile fields. Provider names remain protected by column grants. */
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

/** Share feed reads across screens; discard the snapshot on account changes. */
const roomCache = createRoomCache(fetchRooms);

supabase.auth.onAuthStateChange((_e, s) => {
  roomCache.reset(s?.user.id);
});

/**
 * Every room the signed-in student may see. One request: RLS decides the rows,
 * so there is no "visible to me" filter to get wrong on the client.
 */
export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>(roomCache.rooms);
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
  const [loading, setLoading] = useState(!roomCache.rooms.length);
  const [settled, setSettled] = useState(false);
  const requestVersion = useRef(0);

  const reload = useCallback(() => {
    const version = ++requestVersion.current;
    return roomCache.read()
      .then((r) => {
        if (!r || version !== requestVersion.current) return;
        setRooms(r);
        setError(undefined);
      })
      .catch((error) => { if (version === requestVersion.current) setError(error); })
      .finally(() => {
        if (version !== requestVersion.current) return;
        setLoading(false);
        setSettled(true);
      });
  }, []);

  useEffect(() => {
    let userId = roomCache.userId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (userId === session?.user.id) return;
      userId = session?.user.id;
      ++requestVersion.current;
      clearTimeout(timer);
      setRooms([]);
      setError(undefined);
      setSettled(false);
      setLoading(!!userId);
      if (userId) timer = setTimeout(() => void reload(), 0);
    });
    return () => { ++requestVersion.current; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [reload]);

  // Hidden tabs stay mounted. Only the focused screen needs a polling timer.
  useFocusEffect(useCallback(() => {
    void reload();
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void reload();
    }, ROOM_REFRESH_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => { clearInterval(id); sub.remove(); };
  }, [reload]));

  return { rooms, loading, settled, error, reload };
};

/**
 * Re-renders on a cadence so "LIVE · 22 MIN" doesn't go stale on screen.
 *
 * A clock, not a fetch: this moves `now` forward so the derived labels recompute
 * from rooms already in memory. A room somebody else opened still won't appear
 * until the focused screen's next refresh.
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

/** Use the authenticated server proxy; reuse the session token for autocomplete and details. */
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

/** Create the room, pin, and host membership atomically through the rate-limited RPC. */
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

/** Updates/deletes may succeed with zero affected rows under RLS; treat that as refusal. */
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

/** The RPC returns blocked profiles that ordinary profile reads cannot access. */
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

/** Delete the login while preserving room tombstones and moderation history. The caller signs out next. */
export const deleteAccount = async () => {
  const { error } = await supabase.rpc('delete_me');
  if (error) throw error;
};

/** Haptic failures must not fail a successful operation. */
export const tapOk = () =>
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const tapFail = () =>
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});

/** Prevent duplicate writes and report failures at the point of interaction. */
export const useWrite = () => {
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      if (busy) return false;
      setBusy(true);
      try {
        await fn();
        tapOk();
        return true;
      } catch {
        // Most failures here are a policy refusing a write, and its message is
        // a Postgres string. "Try again" is the honest version of that.
        tapFail();
        Alert.alert("That didn't work", 'Try again in a moment.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  return { busy, run };
};
