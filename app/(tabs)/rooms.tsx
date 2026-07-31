import { useRooms } from '../../api';
import { Rooms } from '../../screens/Rooms';
import { useSession } from '../../session';

/**
 * Routes fetch; screens draw. A failed load is thrown so the layout's
 * ErrorBoundary catches it — it already renders the message and a retry.
 */
export default function RoomsRoute() {
  const { rooms, loading, error } = useRooms();
  const { me } = useSession();
  if (error) throw error;
  if (loading || !me) return null;
  return <Rooms rooms={rooms} me={me} />;
}
