import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchPerson, useRooms } from '../../../api';
import type { Person } from '../../../data';
import { NotFound } from '../../../screens/NotFound';
import { Profile } from '../../../screens/Profile';

export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, loading, error } = useRooms();
  // One state, three answers: undefined while loading, null once we know there's
  // no such person, an Error if the request itself failed. Kept as state and not
  // a ref because the re-render is the delivery mechanism — the throw below only
  // runs on the render that the resolution schedules.
  const [person, setPerson] = useState<Person | null | Error>();

  useEffect(() => {
    let live = true;
    // The rejection handler is not optional: without it a failed request is an
    // unhandled rejection *and* leaves `person` undefined forever, so the screen
    // renders null for good rather than saying anything went wrong.
    fetchPerson(id).then(
      (p) => live && setPerson(p ?? null),
      (e) => live && setPerson(e instanceof Error ? e : new Error(String(e)))
    );
    return () => {
      live = false;
    };
  }, [id]);

  if (error) throw error;
  if (person instanceof Error) throw person;
  if (loading || person === undefined) return null;
  // A stale link is a dead link. This used to fall back to your own profile,
  // which showed you yourself as though you'd asked for someone else.
  if (person === null) return <NotFound />;
  return <Profile person={person} rooms={rooms} />;
}
