import { useRooms } from '../../api';
import { Rooms } from '../../screens/Rooms';
import { useSession } from '../../session';

export default function RoomsRoute() {
  const { rooms, loading, error } = useRooms();
  const { me } = useSession();
  if (error) throw error;
  if (loading || !me) return null;
  return <Rooms rooms={rooms} me={me} />;
}
