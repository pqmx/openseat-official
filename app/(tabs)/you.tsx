import { useRooms } from '../../api';
import { YourProfile } from '../../screens/Profile';
import { useSession } from '../../session';

export default function YouRoute() {
  const { me } = useSession();
  // The rooms you host are read from the same feed every other route reads, so
  // "ROOMS YOU HOST" can't disagree with the Rooms tab about what you host.
  const { rooms, loading, error } = useRooms();
  if (error) throw error;
  if (!me || loading) return null;
  return <YourProfile me={me} rooms={rooms} />;
}
