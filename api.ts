import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { Access, Draft, Person, Room, Update } from './data';
import { supabase } from './supabase';

/**
 * The seam AGENTS.md always pointed at. Everything here turns Supabase rows
 * into the shapes `data.ts` derives labels from — snake_case to camelCase,
 * timestamps to `Date`, and the two membership states back into the
 * `attendees` / `requests` split the screens already read.
 *
 * No filtering happens here that the database isn't already doing. Year
 * visibility and casual-room coordinates are RLS policies; if a row arrives,
 * you were allowed to see it.
 */

const personCols = 'id, name, short, initials, year, major, dorm, tone, interests, prompts';

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
  dorm: r.dorm ?? undefined,
  tone: r.tone ?? undefined,
  interests: r.interests?.length ? r.interests : undefined,
  prompts: r.prompts?.length ? r.prompts : undefined,
});

const toUpdate = (r: any): Update => ({
  id: r.id,
  text: r.body,
  at: new Date(r.created_at),
  by: toPerson(r.author),
  seenBy: r.seen_by,
});

const roomCols = `
  id, title, place, street, walk_minutes, starts_at, canceled_at, capacity,
  access, casual, years, blurb, approx_lat, approx_lng,
  host:profiles!rooms_host_id_fkey(${personCols}),
  pin:room_pins(lat, lng),
  members:room_members(state, profile:profiles!room_members_profile_id_fkey(${personCols})),
  updates:room_updates(id, body, created_at, seen_by,
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
    street: r.street,
    walkMinutes: r.walk_minutes,
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
    blurb: r.blurb ?? undefined,
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
 * The one write onboarding needs. `year` is not cosmetic: `rooms_select` keys
 * the whole feed off it, so a profile without one sees almost nothing.
 */
export const saveProfile = async (
  id: string,
  patch: { year: string; major?: string; dorm?: string },
) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      year: patch.year,
      major: patch.major?.trim() || null,
      dorm: patch.dorm?.trim() || null,
    })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Every room the signed-in student may see. One request: RLS decides the rows,
 * so there is no "visible to me" filter to get wrong on the client.
 */
export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return fetchRooms()
      .then((r) => {
        setRooms(r);
        setError(undefined);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rooms, loading, error, reload };
};

/** Re-renders on a cadence so "LIVE · 22 MIN" doesn't go stale on screen. */
export const useNow = (everyMs = 30_000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
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
