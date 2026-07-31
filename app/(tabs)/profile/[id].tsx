import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchPerson, useRooms } from '../../../api';
import type { Person } from '../../../data';
import { NotFound } from '../../../screens/NotFound';
import { Profile } from '../../../screens/Profile';

export default function ProfileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rooms, loading, error } = useRooms();
  // undefined while loading, null once we know there's no such person.
  const [person, setPerson] = useState<Person | null>();

  useEffect(() => {
    let live = true;
    fetchPerson(id).then((p) => live && setPerson(p ?? null));
    return () => {
      live = false;
    };
  }, [id]);

  if (error) throw error;
  if (loading || person === undefined) return null;
  // A stale link is a dead link. This used to fall back to your own profile,
  // which showed you yourself as though you'd asked for someone else.
  if (person === null) return <NotFound />;
  return <Profile person={person} rooms={rooms} />;
}
