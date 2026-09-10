import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { Access, Draft, Person, Room, Tone, Update } from './data';
import { feedWindowEnd } from './data';
import { ROOM_PAGE_SIZE, MAX_UPDATE_LENGTH, MAX_REPORT_LENGTH, type FeedWindow } from './room-rules';
import { UserError } from './errors';
import { invalidateRooms, useRoomResource } from './room-resource';
import { supabase } from './supabase';

/** Convert Supabase rows to app data. Database policies enforce access. */

const personCols = 'id, name, short, initials, year, major, tone, interests, prompts';

/** Detail rosters omit profile prompts and interests; fetchPerson owns those. */
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
  id, title, place, starts_at, ends_at, ended_at, canceled_at, capacity,
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
    host: r.host ? toPerson(r.host) : { id: r.host_id ?? '', name: 'Unavailable', short: 'Unavailable', initials: '?', year: '', major: '' },
    startsAt: new Date(r.starts_at),
    endsAt: r.ends_at ? new Date(r.ends_at) : undefined,
    endedAt: r.ended_at ? new Date(r.ended_at) : undefined,
    attendeeCount: r.attendee_count === undefined ? undefined : Number(r.attendee_count),
    viewerId: r.viewer_id,
    viewerState: r.viewer_state ?? undefined,
    canceledAt: r.canceled_at ? new Date(r.canceled_at) : undefined,
    capacity: r.capacity,
    access: r.access,
    years: r.years ?? undefined,
    attendees: named('member'),
    requests: named('requested'),
    // Newest first: the room screen and every preview show `updates[0]`.
    updates: (r.updates ?? []).filter((u: any) => !!u.author).map(toUpdate).sort((a: Update, b: Update) => +b.at - +a.at),
  };
};

export type RoomScope = 'discover' | 'mine' | 'host';
export type RoomQuery = { scope?: RoomScope; hostId?: string; window?: FeedWindow; openOnly?: boolean };
type Cursor = { at: string; id: string };

/** Filters precede pagination; summary pages retain database RLS. */
export const fetchRoomPage = async (query: RoomQuery, cursor?: Cursor) => {
  const { data, error } = await supabase.rpc('room_summary_page', {
    p_scope: query.scope ?? 'discover', p_host: query.hostId ?? null,
    p_window: query.window ?? 'Live',
    p_before: feedWindowEnd(query.window ?? 'Live', new Date()).toISOString(),
    p_open_only: !!query.openOnly, p_cursor_at: cursor?.at ?? null, p_cursor_id: cursor?.id ?? null,
    p_limit: ROOM_PAGE_SIZE + 1,
  });
  if (error) throw error;
  const rows: any[] = data ?? [];
  const shown = rows.slice(0, ROOM_PAGE_SIZE);
  const last = shown.at(-1);
  return { rooms: shown.map(toRoom), next: rows.length > ROOM_PAGE_SIZE && last
    ? { at: last.starts_at as string, id: last.id as string } : undefined };
};

/** A room link is independent of whichever feed pages have been loaded. */
export const fetchRoom = async (id: string): Promise<Room | null> => {
  const { data, error } = await supabase.from('rooms').select(roomCols).eq('id', id)
    .order('created_at', { referencedTable: 'updates', ascending: false })
    .limit(20, { referencedTable: 'updates' }).maybeSingle();
  if (error) throw error;
  return data ? toRoom(data) : null;
};

export const useRoom = (id: string) => {
  const fetchValue = useCallback(() => fetchRoom(id), [id]);
  const result = useRoomResource('room:' + id, fetchValue);
  return { ...result, room: result.data };
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

/** Fetch only pages the user requested, preserving them while refreshing. */
export const useRooms = (query: RoomQuery = {}) => {
  const { scope = 'discover', hostId, window = 'Live', openOnly = false } = query;
  const baseKey = JSON.stringify([scope, hostId, window, openOnly]);
  const [pagination, setPagination] = useState({ key: baseKey, count: 1 });
  const count = pagination.key === baseKey ? pagination.count : 1;
  const fetchValue = useCallback(async () => {
    let cursor: Cursor | undefined;
    const rooms: Room[] = [];
    for (let page = 0; page < count; page++) {
      const result = await fetchRoomPage({ scope, hostId, window, openOnly }, cursor);
      rooms.push(...result.rooms);
      cursor = result.next;
      if (!cursor) break;
    }
    return { rooms: [...new Map(rooms.map((room) => [room.id, room])).values()], hasMore: !!cursor };
  }, [scope, hostId, window, openOnly, count]);
  const result = useRoomResource(baseKey + ':' + count, fetchValue);
  const previous = useRef<{ key: string; userId?: string; data: Awaited<ReturnType<typeof fetchValue>> } | undefined>(undefined);
  useEffect(() => {
    if (result.data) previous.current = { key: baseKey, userId: result.userId, data: result.data };
  }, [baseKey, result.data, result.userId]);
  const data = result.data ?? (previous.current?.key === baseKey && previous.current.userId === result.userId
    ? previous.current.data : undefined);
  return { ...result, rooms: data?.rooms ?? [], hasMore: data?.hasMore ?? false,
    loading: !data && result.loading, settled: !!data || !!result.error,
    loadMore: () => { if (!result.refreshing && data?.hasMore) setPagination({ key: baseKey, count: count + 1 }); } };
};

/** Clocks stop on hidden screens and while the app is in the background. */
export const useNow = (everyMs = 10_000) => {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = (active: boolean) => {
      clearInterval(timer);
      if (active) { setNow(new Date()); timer = setInterval(() => setNow(new Date()), everyMs); }
    };
    update(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', (state) => update(state === 'active'));
    return () => { clearInterval(timer); sub.remove(); };
  }, [everyMs]));
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
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number }> => {
  const { data, error } = await supabase.functions.invoke<{ lat: number; lng: number }>(
    'places-search',
    { body: { placeId: id, session }, signal },
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
  invalidateRooms();
  return data as string;
};

/** Updates/deletes may succeed with zero affected rows under RLS; treat that as refusal. */
const changed = <T>(
  { data, error }: { data: T[] | null; error: { message: string } | null },
  refusal: string,
) => {
  if (error) throw error;
  if (!data?.length) throw new UserError(refusal);
  invalidateRooms();
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

export const postUpdate = async (roomId: string, meId: string, body: string) => {
  if (!body.trim() || [...body].length > MAX_UPDATE_LENGTH) throw new UserError('Updates must be between 1 and 500 characters.');
  return changed(
    await supabase.from('room_updates').insert({ room_id: roomId, author_id: meId, body }).select('id'),
    'Only the host can post updates here.',
  );
};

export const endRoom = async (roomId: string, cancel = false) =>
  changed(
    await supabase.from('rooms').update(cancel ? { canceled_at: new Date().toISOString() } : { ended_at: new Date().toISOString() }).eq('id', roomId).select('id'),
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
}) => {
  if ([...(report.detail ?? '')].length > MAX_REPORT_LENGTH) throw new UserError('Report details must be 1,000 characters or fewer.');
  return changed(
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
};

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
