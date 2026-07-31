import { useCallback, useEffect, useState } from 'react';
import type { Draft, Person, Room, Update } from './data';
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
  const named = (state: string) =>
    members.filter((m) => m.state === state && m.profile).map((m) => toPerson(m.profile));
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
 * in, so it is a single `security definer` function instead.
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
